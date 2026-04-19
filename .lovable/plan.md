

User wants to SEE the corrected/restored numbers — not propose another code fix. They want a clear breakdown of what the true totals are after the recycling, with archived data included.

## Plan

Pull the real combined numbers from `qr_cards` + `archived_card_data` + `transactions` + `marketplace_item_allocations` for both of today's events and present them clearly.

### Numbers to show per event (Morning Day 2 + Afternoon Day 2)

For each marketplace:

1. **Total Beneficiaries Served** = live `active` + live `checked_out` + `archived_card_data` count
2. **Items Distributed** = `SUM(distributed_quantity)` from `marketplace_item_allocations` (untouched by reset — accurate)
3. **Credits Used** = same as Items Distributed (per memory rule)
4. **Demographics breakdown** (gender / nationality / marital_status / children) — merge live + archived
5. **Transactions count** (Distribution type, scoped to event date) — independent verification

### Output format

Concise table per event:

```
MORNING DAY 2 (5404f771...)
─────────────────────────────
Beneficiaries served:   913   (35 live active + 0 live checked + 878 archived)
Items distributed:      X,XXX (from allocations)
Credits used:           X,XXX
Gender split:           M:xx  F:xx
Marital status:         ...
Top nationalities:      ...

AFTERNOON DAY 2 (12ec567f...)
─────────────────────────────
Beneficiaries served:   ~610  (171 live active + 102 live checked + 337 archived)
Items distributed:      X,XXX
...

DAY 2 COMBINED TOTAL
─────────────────────────────
Beneficiaries:    1,523
Items:            X,XXX
```

Then a one-line summary so admin can hand it to the DH manager.

### How

Single read-only SQL pass against the database. No code changes, no writes — pure reporting from the live tables to confirm the true numbers exist and where each piece lives.

If admin wants these numbers to also appear in the live dashboards (ExitZone, Stats), the previously-proposed fix to `useCardStats` + `StatsDashboardZone` is still available — but that's separate from this read-out.

