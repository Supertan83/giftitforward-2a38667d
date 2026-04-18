
Update today's Taxi Drivers Afternoon Event `beneficiary_credit_limit` from 15 → 29 via direct DB update, matching what we already did for the morning event.

## Plan

1. UPDATE `marketplace_events` SET `beneficiary_credit_limit = 29`, `updated_at = now()` WHERE name ILIKE '%taxi%' AND event_date = today AND it's the afternoon slot.
2. Confirm to admin.

No code or schema changes.
