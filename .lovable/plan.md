# Reset all QR cards for evening marketplace

## Current state (live from DB)
- **987** cards `checked_out` (carry old `marketplace_id`)
- **142** cards `active` at the morning event (`a2d85409-96f2-458e-9c5f-53d0a3100f67`) — never exit-scanned
- **828** cards already `inactive` (ready to use)
- **Total to reset: 1,129 cards**

## Goal
Every physical QR card must be `inactive`, unlinked from any marketplace, with zero balance, so any card scanned at tonight's **She Thrives Afternoon Event** entrance starts fresh.

## Plan

### 1. Force-checkout the 142 still-active morning cards (audit trail)
For each of the 142 `active` cards in the morning marketplace, insert a synthetic `CheckOut` transaction:
- `type = 'CheckOut'`
- `marketplace_id = a2d85409-96f2-458e-9c5f-53d0a3100f67` (morning)
- `timestamp = now()`
- `credit_change = 0`

This preserves the morning marketplace's reporting integrity (their final items-collected counts stay intact in transaction history) before we wipe the card row.

### 2. Reset all non-inactive cards to inactive
Single `UPDATE qr_cards` covering all 1,129 cards where `status IN ('active','checked_out')`:
- `status` → `'inactive'`
- `credit_balance` → `0`
- `total_items_collected` → `0`
- `collected_items` → `'[]'::jsonb`
- `marketplace_id` → `NULL`
- `activated_at` → `NULL`
- `updated_at` → `now()`

This is exactly what the nightly `auto-unblock-cards` job does — just run early and across today's cards too.

### 3. Verification
Re-query and confirm: **0 active**, **0 checked_out**, **1,957 inactive**, **0 with marketplace_id**.

## What this will NOT touch
- ❌ Morning marketplace status, demographics, or distribution counts (already locked in `transactions` and `marketplace_item_allocations`)
- ❌ Item allocations / inventory
- ❌ Volunteer cards (`volunteer_qr_cards` is a separate table)
- ❌ Any historical reports — morning reporting reads from `transactions` (with `marketplace_id` stamped on each row), not from current `qr_cards` state

## Important note
Once this runs, the Exit Zone for the morning event will show **0 "Still Active"** and the morning's 384 manually reconciled checkouts remain in transaction history. The afternoon team can begin scanning entries immediately afterward.
