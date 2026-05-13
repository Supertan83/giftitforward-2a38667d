## Sorun

Surpluss platformundaki "Total Items Donated" mini inventory widget'ı 3 sayı gösteriyor:

- **Items received** (örn. 546,005)
- **Number of items distributed** (örn. 500,074)
- **Number of items remaining** (örn. 45,931)

Şu anki davranış:
- `report-surpluss-distribution` her marketplace allocation'ı için sadece `{distributed_amount, remaining_amount = allocated − distributed}` gönderiyor. Yani Surpluss'a sadece **marketplace seviyesinde** rapor gidiyor, donor (material) seviyesindeki "remaining" güncellenmiyor.
- Surpluss mini inventory ise **material seviyesinde** çalışıyor: `received` = donor toplam donation, `remaining` = material'in donor stoğunda kalan kısım.
- Bu yüzden distributed/remaining/received üçlüsü GIF gerçeğiyle senkron değil.

Kullanıcının istediği mantık: **Remaining = Received − Allocated** (yani henüz hiçbir marketplace'e atanmamış donor stoğu). Tüm 3 sayı da GIF'in resmi rakamlarıyla aynı olmalı.

## Yapılacaklar

### 1. Yeni edge function: `sync-surpluss-inventory`

Her material (external_material_id) için tek seferde donor seviyesinde Surpluss'a şunu gönderir:
- `material_id`
- `total_received` = `external_items.item_count` toplamı (donor envanteri)
- `total_allocated` = GIF'teki tüm aktif `marketplace_item_allocations.allocated_quantity` toplamı
- `total_distributed` = manual count varsa onu, yoksa `distributed_quantity` toplamı (mevcut report-surpluss-distribution mantığıyla aynı)
- `total_remaining` = `total_received − total_allocated`

İki API çağrısı seti yapar:
1. **Per-allocation distribution PUT** → mevcut `report-surpluss-distribution` payload'ı (her marketplace allocation için günceller).
2. **Per-material reconcile** → mevcut `surpluss-allocations-api` `reconcile_donation_remaining` action'ını her unique material_id için çağırır → bu Surpluss'taki donor "remaining"i GIF'in allocated'ına göre yeniden hesaplatır.

Sonuç: Surpluss tarafındaki mini inventory hem distributed hem remaining hem de allocated rakamlarını GIF'ten alır.

### 2. UI: "Sync Mini Inventory to Surpluss" butonu

`SurplussSyncPanel` (Admin → Surpluss Sync) içine yeni bir kart:

- **Buton**: "Sync Inventory Snapshot to Surpluss"
- **Environment seçimi**: Staging / Production toggle (mevcut pattern)
- Çalışınca özet gösterir:
  - Materyal sayısı
  - Reconcile edilen (drift olan) sayısı
  - Rapor edilen allocation sayısı
  - Hatalar varsa listeler
- Çalıştırma sonrası mini özet tablosu: Material | Received | Allocated | Distributed | Remaining (GIF tarafı) — kullanıcı GIF ile Surpluss'ı karşılaştırabilsin.

### 3. Otomatik tetikleme (opsiyonel)

`report-surpluss-distribution` çağrıldıktan hemen sonra ilgili material'ler için `reconcile_donation_remaining` otomatik tetiklenir. Böylece her zaman elle "sync" basmaya gerek kalmaz.

## Beklenen Sonuç

Sync sonrası Surpluss mini inventory:
- **Items received** = `SUM(external_items.item_count)` (Surpluss zaten kendi donor verisinden alıyor — bizim göndermemize gerek yok; reconcile sonrası uyum sağlanır)
- **Number of items distributed** = GIF'in raporladığı toplam dağıtım
- **Number of items remaining** = received − allocated (donor warehouse'da hâlâ taahhüt edilmemiş kalan stok)

## Teknik Notlar

- Yeni edge function `verify_jwt = false` değil — admin JWT gerekli.
- Mevcut `bulk_reconcile_remaining` action'ı zaten tüm materialler için reconcile yapabiliyor; yeni edge function bunu çağırıp ardından her marketplace için `report-surpluss-distribution` invoke eder, single transaction olarak loglar.
- Veri kaynağı: `marketplace_item_allocations` (deleted_at IS NULL filtreli), `marketplace_manual_counts` (override), `external_items` (donor envanter), `item_types` (material mapping).
- Audit: tüm çağrılar `surpluss_api_audit_log` ve `surpluss_distribution_reports` tablolarına yazılır.
- UI dosyası: `src/components/admin/SurplussSyncPanel.tsx` — mevcut card pattern'ini takip et.
- Yeni dosyalar: `supabase/functions/sync-surpluss-inventory/index.ts`, `src/hooks/useSurplussInventorySync.ts`.
