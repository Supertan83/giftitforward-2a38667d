

## Fix Incorrect External ID Mappings for April Marketplace Events

### Root Cause
**6 out of 10 upcoming marketplace events have wrong `external_id` values** in the database. When the auto-sync runs, it queries the Surpluss API using these incorrect IDs, which return 0 allocations because they point to different events on the Surpluss platform.

For example, "Mens Construction Facility Workers Marketplace - Morning Event" has `external_id: 34` in GIF, but on the Surpluss platform, ID 34 is actually the **Afternoon** Event. The Morning Event is ID 33.

### Correct Mappings (verified from Surpluss API)

| Marketplace Name | Current ext_id (WRONG) | Correct ext_id |
|---|---|---|
| Mens Construction Facility Workers Marketplace - Morning Event | 34 | **33** |
| Mens Construction Facility Workers Marketplace - Afternoon Event | 36 | **34** |
| Mens Aviation Workers Marketplace - Morning Event | 33 | **35** |
| Mens Aviation Workers Marketplace - Afternoon Event | NULL | **36** |
| Taxi Drivers Marketplace - Morning Event | 39 | **37** |
| Taxi Drivers Marketplace - Morning Event Day 2 | 37 | **39** |

4 events already have the correct mapping (Women Community Workers Morning/Afternoon, Taxi Drivers Afternoon, Taxi Drivers Afternoon Day 2).

### Fix (database only, no code changes)
Run a single SQL migration to correct all 6 external_id values:

```sql
UPDATE marketplace_events SET external_id = 33 WHERE id = '6ed111b0-f003-46e8-a719-d76cc1800431'; -- Construction Morning
UPDATE marketplace_events SET external_id = 34 WHERE id = '3e0ddc6e-5e20-4ab4-9e81-51f2ae2dbd63'; -- Construction Afternoon
UPDATE marketplace_events SET external_id = 35 WHERE id = '3f44eb86-f1c5-48a4-8bf3-5b70b41c5bfd'; -- Aviation Morning
UPDATE marketplace_events SET external_id = 36 WHERE id = 'accc4d0e-de1f-4625-90e1-79c810f7d1fe'; -- Aviation Afternoon
UPDATE marketplace_events SET external_id = 37 WHERE id = 'fa2ad5be-cf2c-4fd4-89f3-2a41d93b2cf5'; -- Taxi Morning
UPDATE marketplace_events SET external_id = 39 WHERE id = '5404f771-ef88-41d0-a05d-584c36699e67'; -- Taxi Morning Day 2
```

### After the Fix
Once the external_ids are corrected, the auto-sync will immediately start pulling the correct allocations from the Surpluss platform. I will trigger a manual sync to verify everything works.

