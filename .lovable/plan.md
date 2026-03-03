

# Fix: Volunteer Check-Out Latency

## Problem
The volunteer checkout flow performs **5 sequential database operations** plus a **synchronous edge function call** (`send-survey`) that blocks the UI. The `send-survey` function itself does 4+ more DB queries and an external API call (HubSpot/Resend). Total: ~8 network round-trips, all awaited serially.

```text
Current flow (sequential, blocking):
1. Find card + joins          ~200ms
2. Update card status         ~200ms
3. Query attendance record    ~200ms
4. Update attendance record   ~200ms
5. Invoke send-survey         ~2-5s (cold boot + DB + external API)
───────────────────────────────
Total:                        ~3-6 seconds
```

## Solution

Two changes to bring checkout to ~200ms:

### 1. Create an atomic RPC function for volunteer checkout
Same pattern used for beneficiary operations (`checkout_beneficiary_card`). Consolidates steps 1-4 into a single database round-trip.

**New DB function: `checkout_volunteer_card(p_unique_id text)`**
- Finds the card by unique_id
- Validates status is `checked_in` and minimum 1-minute duration
- Updates card to `checked_out`, sets `checked_out_at`, calculates `total_hours_worked`
- Updates the matching `volunteer_attendance` record
- Returns volunteer info (card_id, volunteer email/name, marketplace_id, hours_worked) needed for survey

### 2. Fire-and-forget the survey email
The `send-survey` edge function call does not need to block checkout. Change `await supabase.functions.invoke('send-survey', ...)` to a fire-and-forget call (no `await`). The UI shows success immediately; the survey sends in the background.

```text
New flow:
1. RPC checkout_volunteer_card   ~200ms (single round-trip)
2. Fire send-survey (no await)   ~0ms from user perspective
───────────────────────────────
Total:                           ~200ms
```

## Files Changed

1. **Database migration** — New `checkout_volunteer_card` RPC function
2. **`src/hooks/useSupabaseData.ts`** (~lines 1519-1615) — Replace multi-step mutation with single RPC call + fire-and-forget survey invoke

