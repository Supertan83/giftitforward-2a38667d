
The 82 in-queue beneficiaries are cards activated at Taxi Drivers Morning that haven't been checked out yet (`status = 'active'`, `marketplace_id = morning_id`).

To "transfer" them to Afternoon = reassign their active session to the Afternoon marketplace so they can collect items there. Morning historical transactions stay as-is — Morning reports unaffected.

**Quick clarification needed before executing** — what should happen to credits already used in Morning?

## Plan

1. Identify Morning + Afternoon marketplace IDs for today's Taxi Drivers events.
2. Find the 82 cards: `qr_cards WHERE status='active' AND marketplace_id = morning_id`.
3. Update those cards based on chosen behavior (see options below) — set `marketplace_id = afternoon_id`, adjust `credit_balance` / `total_items_collected`.
4. Insert a `CheckIn` transaction row for each card tied to the Afternoon marketplace so attendance counts there.
5. Confirm with admin: count moved + before/after numbers per event.

## Behavior options (pick one)

- **A. Fresh 29 credits at Afternoon** — reset balance to 0, items_collected to 0. They can collect up to 29 new items at Afternoon. Recommended if Morning collection is considered "complete".
- **B. Carry remaining credits over** — keep existing `credit_balance` + `total_items_collected`. If they used 10/29 in Morning, they get 19 left at Afternoon (limit stays 29).
- **C. Only those who collected nothing** — only transfer cards with `total_items_collected = 0`. Others stay at Morning.

No code or schema changes — pure data update.
