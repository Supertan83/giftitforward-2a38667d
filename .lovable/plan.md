

## Fix Morning Event Beneficiary Count Showing "0"

### Problem
When we recycled the 1,107 morning cards for the afternoon event, all cards were reset and unlinked from the morning marketplace. Since there's no `manual_beneficiary_count` or `demographics_reach` saved, and no `archived_card_data`, the morning event now shows 0 beneficiaries.

### Root Cause
The card recycling cleared `marketplace_id` on all cards but didn't preserve a historical beneficiary count. The system memory note confirms the priority: `manual_beneficiary_count` → `demographics_reach` → live card count. All three are currently 0/null for the morning event.

### Fix
**Set `manual_beneficiary_count = 1082`** on the Morning Event. This number comes from actual transaction data (1,082 unique cards that had Distribution or CheckOut transactions on that marketplace).

```sql
UPDATE marketplace_events
SET manual_beneficiary_count = 1082
WHERE id = '6ed111b0-f003-46e8-a719-d76cc1800431';
```

Also set `demographics_reach = 1082` so the demographics editor shows the correct reach:

```sql
UPDATE marketplace_events
SET demographics_reach = 1082,
    demographics_updated_at = now()
WHERE id = '6ed111b0-f003-46e8-a719-d76cc1800431';
```

This is a data-only fix — no code changes needed. The stats dashboard already reads `manual_beneficiary_count` as the primary source.

