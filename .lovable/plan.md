
Admin couldn't save via UI earlier. They want me to directly update today's Taxi Drivers morning marketplace credit limit to 29 in the database.

Need to: find today's Taxi Drivers morning marketplace and update `beneficiary_credit_limit = 29`.

## Plan

1. Query `marketplace_events` to find today's Taxi Drivers morning event (filter by name ILIKE '%taxi%' AND event_date = today AND morning time slot).
2. Update that row: `beneficiary_credit_limit = 29`.
3. Confirm to admin so distributions can continue with the new limit.

No code or schema changes — pure data update via insert tool.
