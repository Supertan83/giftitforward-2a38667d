

## Fix: Checked Out Count Shows 0 Instead of 891

### Root Cause
When we extended the morning marketplace and reset the 891 checked-out cards back to `inactive`, those cards lost their `checked_out` status and `marketplace_id`. The Stats Dashboard counts checked-out beneficiaries by filtering `qr_cards` with `status === 'checked_out'` — which now returns 0.

However, the data is safe:
- 891 archived records exist in `archived_card_data`
- 891 CheckOut transactions exist in `transactions`

### Fix (1 file change)

**`src/components/zones/StatsDashboardZone.tsx`** — Update the `checkedOut` calculation to combine live checked-out cards with archived cards for the same marketplace. Since the morning event is still active with 120 live active cards (`hasLiveCards = true`), the current logic only looks at live `checked_out` cards and ignores the archive.

Change line 119 from:
```
checkedOut: hasLiveCards ? checkedOutCards.length : fallbackTotal,
```
To:
```
checkedOut: checkedOutCards.length + archivedCards.length,
```

This way, the 891 archived cards are counted alongside any currently checked-out cards, giving the correct total regardless of whether cards have been recycled mid-event.

The same pattern already exists for `totalBeneficiaries`, `genderBreakdown`, and `totalChildren` where archived data supplements live data. This makes `checkedOut` consistent.

### What stays the same
- All other stats (Activated, In Queue, Items Distributed, etc.) are unaffected
- No database changes needed
- No edge function changes needed

