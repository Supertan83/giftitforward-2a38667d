## Sorun Tespiti

DH Form'dan 2-3 Mayıs 2026 için 4 ayrı marketplace slug'ı geldi, ama DB'de sadece **1** marketplace oluşturuldu. Sonuç: 17 volunteer kayıt oldu, **14'ü yanlış/eksik marketplace'e bağlandı**, ve admin panelinde marketplace'ler görünmüyor.

### Webhook'tan gelen 4 slug:

| Slug | Tarih | Saat | Volunteer | Email gitti? |
|---|---|---|---|---|
| `...---morning-event` | **May 2**, 10:00–15:00 | 3 | ✅ 3 |
| `...---morning-event-2` | **May 3**, 10:00–15:00 | 2 | ✅ 2 |
| `...---afternoon-event` | **May 2**, 15:00–20:00 | 6 | ⚠️ 3/6 |
| `...---afternoon-event-2` | **May 3**, 15:00–20:00 | 6 | ⚠️ 4/6 |

### DB'deki tek kayıt:
- "Single Mothers Household Workers Marketplace Morning Event" — **May 2**, 10:00–03:00 (yanlış end_time, external_id NULL)

### Kök Neden — `webhook-receiver/index.ts` `createMarketplacesFromEvents`

Fonksiyondaki fuzzy matching mantığı, `-2` suffix'li slug'ları (May 3 versiyonları) yanlışlıkla `-2`siz mevcut May 2 marketplace'ine eşleştiriyor:

```ts
// satır 614-617 - bug:
const shorter = ... // "Single Mothers Household Workers Marketplace Morning Event"
const longer  = ... // "Single Mothers Household Workers Marketplace Morning Event 2"
if (longer.includes(shorter) || shorter.includes(longer.replace(/\s+\d+\s*$/, '').trim())) {
  // ↑ Burada longer.includes(shorter) TRUE olur,
  //   slugDate (May 3) DB date (May 2) ile uyuşmasa bile
  //   "fuzzy match" yazıp slug'ı eski marketplace'e bağlıyor.
}
```

Üstelik slug'lar (`morning-event`, `afternoon-event`, `morning-event-2`, `afternoon-event-2`) içinde ay/gün ismi yok → `extractDateFromSlug()` `null` dönüyor → tarih kontrolü yapılmıyor → `family-members-joining`, `eventDate` formundan gelen **gerçek tarih** kullanılmadan eşleşme onaylanıyor.

İkinci sorun: DB'deki ilk marketplace `end_time = 03:00:00` (büyük ihtimal "03.00 pm" yanlış parse). Bu da ayrı bir parse bug'ı işareti.

---

## Plan

### 1. Eksik 3 marketplace'i oluştur (one-shot SQL migration)
4 farklı slug için 4 ayrı marketplace olmalı. Mevcut "Morning Event"i koruyup, 3 yenisini ekle ve mevcut marketplace'in `end_time`'ını düzelt:

```text
✓ Single Mothers Household Workers Marketplace - Morning Event   | May 2 | 10:00–15:00 (varolan, end_time fix)
+ Single Mothers Household Workers Marketplace - Afternoon Event | May 2 | 15:00–20:00 (yeni)
+ Single Mothers Household Workers Marketplace - Morning Event 2 | May 3 | 10:00–15:00 (yeni)
+ Single Mothers Household Workers Marketplace - Afternoon Event 2 | May 3 | 15:00–20:00 (yeni)
```

**Not:** İsimlendirme kullanıcının marketplace memory'sindeki "dash separator" kuralına uygun (`Marketplace - Event`).

### 2. Yanlış bağlanmış volunteer'ların etkisini düzelt
Aslında volunteer'lar `marketplace_id`'ye değil `events_list` slug'ına bağlı (pending_volunteers tablosunda marketplace FK yok). Yani 17 volunteer'ın kaydı doğru, sadece marketplace'ler eksik olduğu için admin panelinde grup olarak görünmüyor. Marketplace'leri oluşturduğumuzda volunteer'lar otomatik olarak doğru tarafta listelenecek.

### 3. Eksik welcome email'leri için bilgilendirme
12 volunteer'ın email'i gitmiş, **5'i pending/email_sent=false**. Bunlar için "Resend Welcome Email" butonuna basılması gerekiyor (admin panelden manuel) — VEYA bu plana bir resend tetikleyicisi ekleyebilirim. Sorum 1'e bakın.

### 4. Webhook bug fix — `createMarketplacesFromEvents` (kalıcı çözüm)
İki düzeltme:

**A.** `extractDateFromSlug` `null` dönerse, **`evt.eventDate` form alanından** tarih çıkar ve marketplace eşleştirmede kullan. Şu an bu fallback yok (sadece `getMarketplacesBySlug` içinde var).

**B.** İsim benzerliği matching'inde, "trailing number" (-2, 2 vb.) varlığı **belirleyici fark** olarak ele alınsın:
```ts
const stripTrailingNum = (s: string) => s.replace(/\s+\d+\s*$/, '').trim();
const eventHasSuffix = /\s+\d+\s*$/.test(normalizedEventName);
const mpHasSuffix    = /\s+\d+\s*$/.test(normalizedMpName);
if (stripTrailingNum(normalizedEventName) === stripTrailingNum(normalizedMpName)
    && eventHasSuffix !== mpHasSuffix) {
  continue; // farklı event sayılır, eşleşme atlansın
}
```

Aynı mantık `getMarketplacesBySlug` (satır 401-) içine de eklenecek ki webhook QR/email akışında da volunteer'lar yanlış marketplace'e bağlanmasın.

**C.** Zaman parse bug'ı: `"03.00 pm – 08.00 pm"` aslında 15:00–20:00 olmalı; ilk marketplace'te `end_time=03:00` bu PM/AM normalizasyon hatasını gösteriyor. `parseTimeRange`'i okuyup düzelteceğim.

### 5. Dökümantasyon güncellemesi
`mem://features/marketplace-event-naming-convention` memory'sine "trailing number suffix marks distinct event instance" notu eklenecek.

---

## Etkilenen Dosyalar / İşlemler

| Dosya / İşlem | Tip |
|---|---|
| Migration: 3 marketplace insert + 1 end_time update | SQL |
| `supabase/functions/webhook-receiver/index.ts` | Edit (4 yer: `createMarketplacesFromEvents`, `getMarketplacesBySlug`, `parseTimeRange`, fallback `eventDate`) |
| `mem://features/marketplace-event-naming-convention` | Memory update |

---

## Onay Öncesi Tek Sorum

Pending kalan **5 welcome email**'i otomatik resend edeyim mi (bu plan içinde edge function tetiklensin), yoksa siz admin panelden mi göndereceksiniz? Cevabınızı bekliyorum, sonra implement ediyorum.
