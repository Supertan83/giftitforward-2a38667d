
User wants a fresh, comprehensive read-out of all live numbers — check-ins, check-outs, items distributed, transactions — for today's events, combining live `qr_cards` + `archived_card_data` + `transactions` + `marketplace_item_allocations`.

## Plan

Run a single read-only audit query pass against today's two events (Morning Day 2 `5404f771...` and Afternoon Day 2 `12ec567f...`) and present a clean breakdown.

### Metrics per event

1. **Check-ins (Activated)** = live `active` + live `checked_out` + `archived_card_data` (every archived card was a check-in)
2. **Currently in queue** = live `active`
3. **Checked-out** = live `checked_out` + `archived_card_data`
4. **Items distributed (allocations)** = `SUM(distributed_quantity)` from `marketplace_item_allocations`
5. **Items distributed (transactions cross-check)** = `COUNT(*)` from `transactions` where `type='Distribution'` scoped to event
6. **Returns** = `COUNT(*)` from `transactions` where `type='Return'`
7. **Net items** = Distribution − Return
8. **Avg items per beneficiary**
9. **Volunteer check-ins / check-outs / hours** for the event

### Cross-checks

- Allocations total vs transactions total → flag any drift
- Archived + live counts vs prior reported (913 morning / 632 afternoon)
- Day 2 combined totals

### Output

Clean per-event table + combined Day 2 row + one-line summary suitable to send to DH manager. No code, no DB writes — pure SQL read.
