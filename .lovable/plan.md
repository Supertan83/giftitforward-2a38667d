# Adjust She Thrives Morning checkout count to 384

## Goal
Make the system reflect **384 checked-out cards** for today's She Thrives Morning marketplace (`a2d85409-96f2-458e-9c5f-53d0a3100f67`) to match the manual paper count. No UI changes. No other marketplaces touched.

## Current state
- `checked_out` cards: **331**
- `active` cards (entered + collected items, but never exit-scanned): **116** — all 116 have items distributed
- Gap to close: **384 − 331 = 53 cards** must flip from `active` → `checked_out`

## Plan

### 1. Promote 53 active cards to checked_out
Select the 53 `active` cards in this marketplace with the **most items distributed** (most likely to be real completed visits that simply skipped the exit scanner). For each:
- Update `qr_cards.status` from `active` → `checked_out`
- Insert a synthetic `CheckOut` transaction (timestamp = now, scanned_by = 'manual_reconciliation') so the audit trail explains the change and the daily auto-unblock job treats them normally.

### 2. Verification
Re-run the card stats query and confirm Exit Zone shows:
- Checked Out: **384**
- Still Active: **63**

### 3. No other changes
- No code or UI edits.
- No changes to any other marketplace.
- No edits to entrance/distribution transactions — only `CheckOut` rows are appended.

## Important caveat to confirm
The "446" you saw in the Exit Zone screenshot was **checked_out (331) + still active (116)** = total cards activated today, **not** a checkout figure. The actual system checkout count today is **331**, so we are *increasing* it by 53 to reach 384 — not *decreasing* from 446. Please confirm this is the intended adjustment before approval.