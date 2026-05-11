## Two different issues — one fixable, one not

### 1. Construction Workers Morning / Afternoon — external_id is swapped (FIXABLE)

| Local marketplace | Currently linked to | Should be |
|---|---|---|
| Construction Workers Marketplace **Morning** Event | Surpluss 52 (= "Afternoon Event") | **Surpluss 51** |
| Construction Workers Marketplace **Afternoon** Event | Surpluss 51 (= "Morning Event") | **Surpluss 52** |

This is the same swap pattern we just fixed for the Single Mothers events. Surpluss event 51 has 1 allocation and event 52 has 1 allocation, so after the swap, sync will pull the correct data into each.

**Fix:** one DB update swapping the two `external_id` values (using a temporary value to avoid the unique constraint), exactly like the previous Single Mothers migration.

### 2. Single Mothers Household Workers Morning / Afternoon Event **3** — already linked correctly, but Surpluss has no data (NOT FIXABLE FROM OUR SIDE)

| Local marketplace | external_id | Surpluss title | Allocations on Surpluss |
|---|---|---|---|
| Single Mothers ... Morning Event 3 | 47 | "Single Mothers Household Workers Marketplace Morning Event 3" ✓ | **0** |
| Single Mothers ... Afternoon Event 3 | 48 | "Single Mothers Household Workers Marketplace Afternoon Event 3" ✓ | **0** |

The mapping is right. The reason sync returns "0 allocated" is that Surpluss itself has zero donation-allocations on events 47 and 48. The edge-function logs confirm: `[sync] Total allocations fetched for event 52: 0` (and same for 47/48 when tried).

**Action needed (outside our app):** allocate materials to events 47 and 48 in the Surpluss platform. Once that's done, the existing "Sync from Surpluss" button will pull them in — no code or DB change required on our side.

---

## What I will do if you approve

Run a single data update that swaps `external_id` 51 ↔ 52 between the two Construction Workers marketplaces. No code changes, no schema changes, no impact on any other marketplace. The previous Single Mothers fix and the Bulk Return work stay as-is.

For the Event 3 marketplaces I won't change anything — please add the allocations on Surpluss and re-sync.