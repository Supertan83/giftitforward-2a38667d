
Yesterday's (4/18/2026) marketplace beneficiary counts — verified against transactions table.

## Current state

| Marketplace | Stored count | Archived | Live cards | Distinct cards in transactions |
|---|---|---|---|---|
| Morning Event | **470** | 0 | 0 | 470 ✅ |
| Afternoon Event | **418** | 400 | 17 | 422 ⚠️ |

## Findings

**Morning (470)** — perfectly matches the 470 distinct cards that have transactions for this event. ✅ Correct, no action needed.

**Afternoon (418)** — slightly off. Transactions table shows **422 distinct cards** were used at this event (400 archived + 17 live + 5 cards that have transactions but are no longer linked because they got reset/reused). Current stored value is 418 = 400 archived + 18 live (one live card was likely re-archived since yesterday's fix).

The most accurate number = **422** (distinct cards from immutable transactions table — the ground truth).

## Plan

Update the Afternoon Event to reflect the verified 422 figure:

```sql
UPDATE marketplace_events 
SET manual_beneficiary_count = 422, 
    demographics_reach = 422,
    updated_at = now()
WHERE id = 'a5a856a1-097b-42b0-a68f-a24c629f9e58';
```

Morning event stays at **470** (already correct).

After this fix:
- Morning: **470 beneficiaries** ✅
- Afternoon: **422 beneficiaries** ✅

No code changes — pure data correction.
