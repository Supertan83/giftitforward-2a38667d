## What's wrong

The local marketplace **"She Thrives: Women Workers Marketplace Afternoon Event"** (id `e55c17ed-…`) has `external_id = NULL`, so the Allocation page hides the **Sync from Surpluss** button.

The matching Surpluss event **does exist** (external_id = **50**, title `She Thrives: Women Workers Marketplace Afternoon Event`). The auto-linker should have wired them together but didn't, for a clear reason:

- A different, **soft-deleted** marketplace ("Women In Facilities Management Marketplace Morning Event", deleted on 2026-04-26) is still holding `external_id = 50` in the DB.
- `fetch-surpluss-marketplaces` reads `marketplace_events` **without filtering `deleted_at IS NULL`**, so it sees ext_id 50 as "already existing" and skips both linking and creating, leaving the active afternoon event orphaned.

## Fix (two parts)

### 1. Manual data fix (immediate, unblocks today)
Run a one-shot migration:
- Clear `external_id` on the soft-deleted row `93d755de-bc6a-450c-9327-cb101c4372b5` (it's deleted; it shouldn't claim the ID).
- Set `external_id = 50` on the live row `e55c17ed-5394-4cfd-9a4d-db8aa05c5001` (She Thrives Afternoon Event).

After this, the Allocation page will show **Sync from Surpluss** for that marketplace.

### 2. Code fix in `supabase/functions/fetch-surpluss-marketplaces/index.ts` (prevent recurrence)
Change the `existingMarketplaces` query to ignore soft-deleted rows:

```ts
.from('marketplace_events')
.select('id, name, external_id')
.is('deleted_at', null)
```

So future deletions never block a fresh Surpluss event from linking.

## Out of scope
- No other marketplaces, no UI changes, no allocation logic touched.

Awaiting approval to apply the migration and the one-line fetch function fix.