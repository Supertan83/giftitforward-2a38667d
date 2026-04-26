# Extend Afternoon Marketplace End Time by 2 Hours

## Goal
Extend tonight's **She Thrives: Women Workers Marketplace - Afternoon Event** so volunteers can keep scanning beneficiaries for an extra 2 hours.

## Current state (live from DB)
- Event ID: `e55c17ed-5394-4cfd-9a4d-db8aa05c5001`
- Date: 2026-04-26
- Start: 14:30
- **End: 20:00** ← needs to change

## Change
Single SQL update on `marketplace_events`:
```sql
UPDATE marketplace_events
SET end_time = '22:00:00', updated_at = now()
WHERE id = 'e55c17ed-5394-4cfd-9a4d-db8aa05c5001';
```

## Result
- New end time: **22:00 (10:00 PM)**
- Status stays `active` — no other fields touched
- All zones (Entrance, Marketplace, Exit) remain operational for the extended window

## Not affected
- Morning event data, transactions, QR card states, allocations, reports — all untouched.