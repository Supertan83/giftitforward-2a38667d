

# Veritabanı Tam Yedekleme (Full Backup) Aracı

## Ne Yapılacak

Admin paneline bir "Database Backup" bölümü eklenecek. Bu araç tüm tabloları tek tek veya toplu olarak JSON/CSV formatında indirmenizi sağlayacak.

## Tablolar ve Boyutları

| Tablo | Kayıt | Not |
|-------|-------|-----|
| surpluss_api_audit_log | 343,737 | Cok buyuk -- parcali indirilecek |
| transactions | 10,310 | |
| qr_cards | 2,100 | |
| email_send_logs | 1,269 | |
| webhook_events | 724 | |
| volunteer_qr_cards | 722 | |
| email_campaign_recipients | 680 | |
| pending_volunteers | 495 | |
| user_roles | 485 | |
| item_types | 337 | |
| surpluss_allocation_sync | 317 | |
| external_items | 313 | |
| volunteer_attendance | 175 | |
| volunteer_surveys | 132 | |
| marketplace_item_allocations | 118 | |
| + 25 kucuk tablo | <100 | |

## Yaklasim

Buyuk tablolari (1000+ satir) parcali olarak cekmek icin bir **edge function** olusturulacak. Kucuk tablolar dogrudan istemci tarafindan cekilecek.

### 1. Edge Function: `backup-table`

- Admin yetkisi kontrol eder
- Tablo adi, offset ve limit parametreleri alir
- Veriyi JSON olarak dondurur
- 1000'er satirlik parcalar halinde calisir

### 2. Admin UI: `DatabaseBackup` Componenti

- Admin dashboard'a yeni bir "Database Backup" bolumu eklenir
- Tum tablolar listelenir (satir sayilariyla)
- "Tumu Indir (ZIP)" butonu: Tum tablolari JSON olarak indirir, tek bir ZIP dosyasina paketler (jszip kutuphanesi zaten yuklu)
- "Tek Tablo Indir" butonu: Secilen tabloyu CSV veya JSON olarak indirir
- Buyuk tablolar icin ilerleme cubugu gosterilir

### 3. Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `supabase/functions/backup-table/index.ts` | Yeni -- tablo verilerini parcali olarak donduren edge function |
| `src/components/admin/DatabaseBackup.tsx` | Yeni -- backup UI componenti |
| `src/components/admin/AdminDashboard.tsx` | Guncelleme -- Database Backup bolumu eklenir |

### 4. Guvenlik

- Edge function admin rolu kontrol eder
- Sadece `public` sema tablolari izin verilir
- Service role key ile veri cekilir (RLS bypass)

### 5. Indirme Formati

- ZIP dosyasi icinde her tablo ayri bir JSON dosyasi olarak yer alir
- Dosya adi: `backup-YYYY-MM-DD/tablo_adi.json`
- Buyuk tablolar (surpluss_api_audit_log gibi) 5000'er satirlik parcalarla cekilip birlestirilir

