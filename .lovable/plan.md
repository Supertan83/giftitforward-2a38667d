## Doğrulama

GIF veritabanında üç marketplace de bulunamadı. 7 ve 9 Mayıs için kayıtlar:

| Tarih | Mevcut GIF Kayıtları |
|---|---|
| 07.05.2026 | Hiç yok |
| 09.05.2026 | Sadece "Family Orphan Marketplace Morning Event" ve "Low Income Families Marketplace **Morning** Event" var. **Afternoon** event eksik. |

Yani kullanıcı haklı — 3 marketplace de GIF'te yok.

## Yapılacak: 3 yeni marketplace_event ekle

### 1. Construction Workers Marketplace – Morning Event
- name: `Construction Workers Marketplace - Morning Event`
- event_date: `2026-05-07`
- start_time: `08:30`, end_time: `13:30`
- location: `Dubai Islands, Deira, Dubai (Dubai Islands Construction Site, please follow GIF signboards)`
- status: `upcoming`

### 2. Construction Workers Marketplace – Afternoon Event
- name: `Construction Workers Marketplace - Afternoon Event`
- event_date: `2026-05-07`
- start_time: `13:30`, end_time: `19:30`
- location: aynı

### 3. Low-income Families Marketplace – Afternoon Event
- name: `Low Income Families Marketplace - Afternoon Event`
- event_date: `2026-05-09`
- start_time: `14:30`, end_time: `20:30`
- location: `Al Khawaneej Street - Al Ttay - Dubai`

Hepsi `external_id = NULL` (Surpluss linkage henüz yok). Daha sonra `fetch-surpluss-marketplaces` çalıştırıldığında fuzzy-name match ile otomatik link olacak (memory: marketplace-slug-name-matching kuralı).

## Teknik

Tek bir migration ile 3 INSERT. RLS gerektirmiyor (admin'in sahip olduğu yetki ile çalışır). `deleted_at = NULL`, `status = 'upcoming'`.

## Sonra

Eklendikten sonra Marketplace Management ekranında görünecek. Allocation/QR kart atama daha sonra yapılabilir. Surpluss tarafında bu eventler oluşturulduğunda **Sync Marketplaces** butonu ile fuzzy match çalışacak ve external_id otomatik atanacak.
