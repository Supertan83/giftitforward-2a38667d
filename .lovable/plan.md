
## Findings

Today's She Thrives Morning marketplace (`a2d85409-…`) currently shows:
- **135 checked-out**, **124 active**, **0 inactive**

But 18 more cards activated today (after midnight) are STILL linked to yesterday's "Inclusive Family — Afternoon Event" marketplace (`71792e7c-…`):
- **15 checked_out**
- **3 active**

This is the same root cause as before — at least one tablet had yesterday's event selected when scanning. Latest stray activation was 10:51 AM local time, so it appears the tablets have since switched correctly (most recent activation on the right marketplace was 11:14 AM).

The cards in your photos (`QR-MLTC4HWM-IEVR`, `QR-MLS7W4O9-7ITX`, `QR-MLTC4HWN-HHF4`) are exactly in this batch — they were scanned today but show yesterday's marketplace name in the Card Status panel.

## Plan

1. **Reattach the 18 stray cards** activated today (≥ 2026-04-26 00:00 UTC) currently linked to yesterday's marketplace (`71792e7c-…`):
   - Update `qr_cards.marketplace_id` → `a2d85409-…` (She Thrives Morning).
   - Keep their existing `status` (`checked_out` / `active`) and timestamps untouched.

2. **Reattach today's transactions for those same cards**:
   - Update `transactions.marketplace_id` → `a2d85409-…` for rows where `card_id` is in that set AND `timestamp >= 2026-04-26 00:00 UTC` AND `marketplace_id = 71792e7c-…`.
   - Older transactions (from genuine yesterday usage) stay linked to yesterday — untouched.

3. **Verify** counters afterwards:
   - Expected today: ~150 checked-out, ~127 active.
   - Yesterday's event returns to its true closed state (no records dated today).

## Out of scope
- No code changes. The Exit Zone counter logic is correct — only data was mis-attributed.
- No schema changes.
- The 9 legitimate yesterday cards under `71792e7c-…` (activated before today) stay where they belong.

## Operational note for the field team
Please double-check every tablet right now has **"She Thrives: Women Workers Marketplace - Morning Event"** selected as the active marketplace. This is the second time today the same drift has happened — at least one tablet was still on yesterday's afternoon event between midnight and ~10:51 AM. If it keeps recurring, we can look at locking scans to only the single `status = 'active'` marketplace at the database level.
