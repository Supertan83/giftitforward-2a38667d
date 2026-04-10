

## Diagnosis: Archive & Reset Partially Failed — Causing Double-Counted Beneficiaries

### What happened

1. **"Archive & Reset Cards"** was pressed for the **She Thrives Women Workers Marketplace February 28**.
2. The **archive step succeeded**: 1,000 card records were copied into the `archived_card_data` table.
3. The **reset step failed** (visible in the screenshot as "Reset Failed — An error occurred"): the 1,000+ cards were NOT cleared — they still have `marketplace_id` pointing to She Thrives and `status = checked_out`.
4. The beneficiary count formula is `archived_card_data count + qr_cards count` for a marketplace (line 920 of `useMarketplaceAllocations.ts`). So now it shows **1,000 (archived) + 1,177 (still-linked cards) = 2,177** instead of the original ~1,183.

**The archive should not have been run on a completed past marketplace that still had 1,169 stuck cards.** It created duplicate records.

### What are "Stuck Cards"?

Cards in `checked_out` status from the Feb 28 She Thrives event. These are cards that were used by beneficiaries and checked out normally — they are NOT errors. They simply weren't reset after that event ended. The system labels them "stuck" because they can't be reused until reset.

### Fix Plan (database corrections, no code changes)

**Step 1 — Remove the duplicate archived records**
The 1,000 archived records were created by the failed archive-and-reset. Delete them to restore the correct count:

```sql
DELETE FROM archived_card_data 
WHERE marketplace_id = 'ff0d8005-7c85-4a8d-9e0c-147475e7b0eb';
```

This restores the beneficiary count to the original ~1,177 (16 active + 1,161 checked_out cards still linked).

**Step 2 — Understand the correct workflow going forward**

The "Archive & Reset" button is designed for **end-of-event cleanup**: after a marketplace is fully complete and you want to free up QR cards for the next event. It archives the beneficiary data for historical records and then wipes the cards clean.

For the She Thrives Feb 28 event (which is already completed), the correct action depends on whether you still need those cards for upcoming April events:

- **If you need the physical QR cards for April events**: Use "Reset All Cards" (which clears them without archiving). The beneficiary data for She Thrives is already captured in the demographics editor and Surpluss sync — you don't need the card-level archive.
- **If you want to preserve card-level data AND free cards**: First fix the archived data, then run Archive & Reset again (but this time the reset should succeed since we'll have fewer cards).

**Step 3 (recommended) — Fix the reset failure root cause**

The reset likely failed because the `.in('id', cardIds)` query had too many IDs (1,177+). The Supabase/PostgREST URL length limit can cause failures with large `IN` clauses. I will update the `archiveAndResetCards` and `resetAllCardsForMarketplace` mutations to batch the reset into chunks of 200 IDs at a time.

### Summary of changes

| Action | Type |
|---|---|
| Delete 1,000 duplicate archived records for She Thrives | Database fix |
| Batch the reset operation into chunks of 200 | Code fix in `useSupabaseData.ts` |

