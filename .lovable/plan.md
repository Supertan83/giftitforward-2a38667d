## Sorun

"Dulsco Bus Activation" marketplace'i için Surpluss sync 0 malzeme dönüyor.

**Kök neden:** Yerel `marketplace_events` kaydında `external_id = 68` olarak ayarlı, ama Surpluss API'sinde bu ID'de bir event yok (404 "Marketplace event not found").

Surpluss event listesini taradığımda "Dulsco Bus Activation" başlıklı event'in gerçek ID'si **53** (status: COMPLETED). Yani external_id yanlış eşleşmiş — büyük olasılıkla daha önce yanlış elle girilmiş veya başka bir event'in ID'sine bakılarak set edilmiş.

```text
Local DB:                          Surpluss:
  Dulsco Bus Activation             id=53  Dulsco Bus Activation  ✅ (gerçek)
  external_id = 68      ❌  →       id=68  (yok)                 → 404
```

Bu yüzden:
- `sync-surpluss-event-allocations` event 68 için 0 allocation çekiyor
- `surpluss-allocations-api get_event_allocations` → 404
- GIF tarafı boş kalıyor

## Çözüm

1. **Yerel external_id'yi düzelt:** `Dulsco Bus Activation` (`c98b7887-…`) kaydının `external_id`'sini **68 → 53** olarak güncelle.
2. **Allocation sync'i tetikle:** `sync-surpluss-event-allocations` fonksiyonunu event 53 için çalıştır → Surpluss'taki gerçek allocation'lar GIF'e (`marketplace_item_allocations`) yazılır.
3. **Doğrula:** Sync sonrası bu marketplace için `marketplace_item_allocations` satırlarının dolduğunu ve UI'da malzeme listesinin göründüğünü kontrol et.

İsteğe bağlı (öneri): `fetch-surpluss-marketplaces` fonksiyonu fuzzy-match yaparken zaten linkli olan kayıtları atlıyor; gelecekte yanlış manuel external_id girişlerini önlemek için MarketplaceManagement UI'ında ID girilirken Surpluss'tan başlık doğrulaması ekleyebiliriz — ama bu ayrı bir iş.

## Onay

Onayladığınızda:
- DB'de external_id 68 → 53 güncellemesi (insert tool ile)
- Sync fonksiyonunu çağır
- Sonuç tablosunu paylaş
