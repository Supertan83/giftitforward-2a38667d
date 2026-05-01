# Why the "Sync Surpluss" button is missing on Item Allocation

## Diagnosis

I checked the database and the code. The button **is correctly wired up** and the four upcoming "Single Mothers Household Workers" marketplaces (May 2 morning/afternoon and May 3 morning/afternoon) **all have a valid `external_id` link to Surpluss** (IDs 43–46).

The button render rule in `AllocationManagement.tsx` is:

```ts
const selectedHasExternalId = selectedMarketplace && selectedMarketplace.external_id;
{selectedHasExternalId && <Button>Sync Surpluss</Button>}
```

Because all four Saturday/Sunday events have `external_id` set, this condition is true and the button **should already render in the current preview**.

The screenshot is from `gif.thesurpluss.com` (the published site), which is most likely running an older deploy from before the "Sync Surpluss" button was added. That is why it isn't visible there.

## Fix

Two small changes to make the situation clearer and safer:

1. **Rename the header button** from "Sync Surpluss" → "Sync from Surpluss" so admins immediately know it pulls Surpluss allocations into GIF (the screenshot shows 0 items in GIF but 83,922 in Surpluss — exactly what this button is for).

2. **Show a small warning** under the marketplace selector when the selected marketplace has **no `external_id`**, e.g.:

   > "This marketplace is not linked to a Surpluss event. Sync is disabled."

   This way, the next time the button doesn't appear, admins immediately understand why instead of assuming it's a bug.

3. **Republish the project** so `gif.thesurpluss.com` picks up the current build. Without republish, the button stays invisible on the live URL no matter what we change in code.

## Files touched

- `src/components/admin/AllocationManagement.tsx` — rename button label, add the "not linked to Surpluss" hint under the marketplace selector.

After approval I'll apply these edits and you can republish to push them to `gif.thesurpluss.com`.
