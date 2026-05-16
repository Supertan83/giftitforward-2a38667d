## Plan: Show items distributed per marketplace in beneficiary scan logs

In `src/components/admin/BeneficiaryQRControlCenter.tsx`, the "All Scan Item Logs" accordion groups transactions by marketplace. Each section currently shows only "N tx". I'll add a clear total of items distributed (and returned) for each section.

### Changes

1. **Compute per-section totals** in the `marketplaceSections` `useMemo`:
   - `totalDistributed` = sum of `quantity` where `type === 'Distribution'`
   - `totalReturned` = sum of `quantity` where `type === 'Return'`
   - `netDistributed` = `totalDistributed - totalReturned` (items the beneficiary actually checked out with)

2. **Display in the section header** (`MarketplaceSectionView` accordion trigger), next to the existing `N tx` badge:
   - Primary badge: `📦 X items distributed` (emerald)
   - If returns > 0: secondary badge `↩ Y returned` (amber)
   - Compact on mobile (407px viewport): stack badges under the marketplace name on small screens.

3. **Add a summary row inside the table footer** of each section:
   - `Total distributed: X` · `Returned: Y` · `Net checked out: Z`
   - Uses semantic tokens (text-emerald-600, text-amber-600, text-muted-foreground) consistent with existing `txTypeColor`.

### Out of scope
- No DB/backend changes.
- No changes to the card-level "Items Collected" header (already shown).
- No new exports or reports.

### File touched
- `src/components/admin/BeneficiaryQRControlCenter.tsx` (frontend only)
