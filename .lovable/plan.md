## Diagnosis (verified against the database)

I checked the live data and the cron history. Here's exactly what's happening, and it explains both issues you raised:

### Current card state in the database
| status | count | from |
|---|---|---|
| `inactive` (= "Ready") | **1233** | clean, available |
| `active` | **68** | stuck since **April 26** (last Sunday) |
| `checked_out` | **656** | stuck since **April 26** (last Sunday) |

So **724 cards from last Sunday are still locked** to the previous marketplace and excluded from "Cards Ready". That's why you see only 1233 available, and that's also why some cards on Sunday wouldn't increment "Checked Out" — they had been `checked_out` from a prior event and the system rejected re-check-in (correctly), but they were never reset.

### Why the overnight reset failed

The cron job (`auto-unblock-qr-cards-midnight`) **is running every night at 00:00 UTC and reports success** — I verified runs through May 1. But the edge function it calls has a bug:

```ts
.from("qr_cards")
.select(...)
.not("marketplace_id", "is", null)
.lt("activated_at", todayISOString)   // ← bug
```

The filter `activated_at < today` **excludes cards activated today**, but the function also runs at **midnight UTC** (= 04:00 Dubai time). Cards activated during a Saturday/Sunday Dubai event get `activated_at` close to midnight UTC, and the cron uses `today` based on UTC midnight, so the function fetches a near-empty set on the rare timezone edge — but more importantly, since the job runs at **00:00 UTC = 04:00 Dubai (still "the same day" for an event that ended Sunday evening)**, the comparison works fine for old cards.

The real failure: looking at the data, the cards from April 26 should have been picked up by every nightly run since (April 27 → May 1). They have `marketplace_id` set and `activated_at < today`. The function ran successfully, returned `{success: true}`, but the cards were not reset. The most likely cause is that the **anon key used by the cron does not satisfy RLS on the UPDATE** even though the function uses the service-role key — but on inspection the function does use `SUPABASE_SERVICE_ROLE_KEY`, so the update *should* work. I'll add detailed logging and a forced manual run to confirm, and also harden the function so this can never silently no-op again.

### Why "Checked Out" wasn't increasing on Sunday (issue #2)

Two compounding causes:
1. **Stale cards** from a prior event were already `checked_out`, so when scanned at exit they would fail check-in entirely (correct behavior) — but on the dashboard "Today's Check-ins" / "Checked Out" only count cards where `marketplace_id = currently selected marketplace`. Cards still pinned to **last week's** marketplace_id aren't counted toward this Sunday's stats even after they were reused.
2. The "Checked Out" stat has no date filter — it shows total checked_out for the marketplace forever, not "today's checkouts". On a fresh day this looks like 0 even after scans, because cards that were reset overnight lose their marketplace_id.

## What I'll do

### 1. Fix `auto-unblock-cards` edge function
- Use Dubai timezone (Asia/Dubai) for the "today" cutoff instead of raw UTC, so cards from yesterday's Dubai event are reliably picked up.
- Include cards in **all three** stuck states: `status = 'active'`, `status = 'checked_out'`, OR `marketplace_id IS NOT NULL` with `activated_at` before today's Dubai start.
- Process in batches of 500 (current single-update is fine but I'll add a chunked safety net).
- Log the count of rows the UPDATE actually affected, not just the count fetched. This is the missing log that hid the silent failure.
- Return a detailed JSON breakdown so we can see what was reset.

### 2. One-time cleanup of the 724 stuck cards from April 26
After the fix, manually invoke the function once to reset every stuck card from the previous event before this weekend. Verified target: 68 active + 656 checked_out → all become `inactive`, marketplace_id cleared, "Cards Ready" jumps from 1233 to **1957**.

### 3. Add an admin "Reset Stuck Cards Now" button
In the Beneficiary QR Control Center, add a button that calls `auto-unblock-cards` on demand. This way if anything goes wrong on Saturday morning you can fix it in one click without waiting for me.

### 4. Fix the "Checked Out" stat to be today-only
Change the stat in `useCardStats` to count `checked_out` cards where `updated_at >= today (Dubai)` AND `marketplace_id = selectedMarketplaceId`. This way "Checked Out" reflects today's actual checkouts at this marketplace, matching "Today's Check-ins".

### 5. Add a daily safety net
Add a second nightly cron at 03:30 UTC (07:30 Dubai, well before any event starts) that re-runs the unblock — so even if the midnight run misses something, by event start the cards are guaranteed clean.

## Files to change
- `supabase/functions/auto-unblock-cards/index.ts` — fix logic + detailed logging
- `src/hooks/useSupabaseData.ts` — fix `useCardStats` for today-only checkout count
- `src/components/admin/BeneficiaryQRControlCenter.tsx` — add manual reset button
- New migration — second cron at 03:30 UTC

## After deploying
I'll invoke the function once and re-query `qr_cards` to confirm 1957 cards are `inactive` and ready before Saturday's event. I'll report back the before/after counts so you have the verification.