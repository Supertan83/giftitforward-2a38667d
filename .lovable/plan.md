## Problem

"Send to Surpluss" akışı tamamlandığında Surpluss tarafında **Item Distributed = 0** görünüyor. Sebep: distribution reporting adımı, `marketplace_item_allocations` tablosunda `surpluss_allocation_id IS NULL` olan satırları **sessizce atlıyor**. Afternoon Event'te 19 allocation'ın 18'i mapping'siz olduğu için report'a hiçbir şey girmiyor; Morning Event'te ise son başarılı report 10 Nisan'dan kalma.

Yani volunteer + beneficiary sync başarılı çalışsa bile, distribution adımı boş geçiyor ve admin bunu fark etmiyor.

## Çözüm (3 katmanlı, tek akışta)

### 1. Pre-flight: eksik mapping varsa otomatik allocation re-sync

`reportMarketplaceDistribution` çağrılmadan önce:
- Marketplace'in tüm `marketplace_item_allocations` satırlarını çek
- `surpluss_allocation_id IS NULL` olan var mı diye bak
- Varsa: önce `sync-surpluss-event-allocations` edge function'ını çağır (mevcut, çalışıyor)
- Sonra allocation listesini **tekrar oku** ve report'a devam et

Bu, admin'in ayrıca "Sync Allocations" butonuna basmasına gerek bırakmaz.

### 2. Transparent skip reporting

`useSurplussDistributionReporting.ts` içinde:
- Mapping tamamlandıktan sonra hâlâ `surpluss_allocation_id` veya `external_material_id` eksik kalan item'ları **say ve isimlendir**
- Toast'ta açıkça göster:
  - Başarılı: `"Distribution Sent — 19/19 allocations reported"`
  - Kısmi: `"Distribution Sent — 18/19 reported. Skipped: 'Winter Jacket' (no Surpluss material mapping)"`
- Skip > 0 ise toast variant'ı warning, bilgilendirici link ile

### 3. Master flow entegrasyonu

`useSurplussVolunteerBeneficiarySync.ts` zincirinin **distribution adımına** pre-flight check'i ekle:

```text
Step 1: Volunteers sync         (mevcut)
Step 2: Beneficiaries sync      (mevcut, batched)
Step 3: ▶ Allocation pre-check  (YENİ)
        → eksik mapping varsa sync-surpluss-event-allocations çağır
Step 4: Distribution report     (mevcut, ama artık tam mapping ile)
```

Final özet toast'ta her adımın sonucu görünür: `Volunteers: 12 | Beneficiaries: 80 | Allocations re-synced: 18 | Distribution: 19/19 reported`.

## Ek karar: idempotency

Distribution report **her tıklamada tüm allocation'lar için** yeniden gönderilecek (Surpluss tarafı PUT endpoint'i; tekrar göndermek mevcut değerleri overwrite eder, duplicate yaratmaz). Bu sayede bir önceki sync'te atlanan item'lar bir sonraki tıklamada otomatik düzeliyor.

## Değişecek dosyalar

- `src/hooks/useSurplussDistributionReporting.ts` — pre-flight allocation sync, skipped item detayı, toast iyileştirmesi
- `src/hooks/useSurplussVolunteerBeneficiarySync.ts` — Step 3'ü distribution'dan önce ekle, özet toast'a allocation-resync sayısını ekle
- (gerekirse) `supabase/functions/sync-surpluss-event-allocations/index.ts` — sadece tek marketplace için tetiklenebildiğinden emin olmak için input doğrulama

DB migration veya yeni secret gerekmiyor.

## Doğrulama

1. Afternoon Event (18/19 mapping eksik) için "Send to Surpluss" → toast'ta "Allocations re-synced: 18, Distribution: 19/19 reported" görünmeli
2. Surpluss UI'da Item Distributed > 0 doğrulanmalı
3. Tekrar tıkla → idempotent: tüm reported, 0 skip
4. Morning Event için aynı doğrulama (497 beneficiary + distribution)
