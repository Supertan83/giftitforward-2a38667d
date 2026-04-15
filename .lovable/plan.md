

## Extend Morning Marketplace — Data-Safe Plan

### Current State (confirmed from database)
- **Morning Event** (`3f44eb86`): Active, ends 13:30, admin-locked — 72 active cards, 891 checked-out cards
- **Afternoon Event** (`accc4d0e`): Already `completed` — no action needed
- **Existing data**: 16,072 distribution transactions, 891 checkout transactions — all safely stored in `transactions` table

### Data Preservation Strategy
The `transactions` table already holds a permanent, immutable record of every distribution and checkout from this morning. That data is never deleted or modified by any card reset.

Additionally, before resetting the 891 checked-out cards, we will **archive them** to `archived_card_data` — this creates a snapshot of each card's state (unique_id, marketplace_id, activated_at, checked_out timing) so you have a full audit trail even after cards are recycled.

### Actions (3 SQL statements via insert tool)

**Step 1 — Archive checked-out cards** (preserves snapshot in `archived_card_data`)
- Insert all 891 checked-out cards into `archived_card_data` with their current marketplace_id, activated_at, unique_id, and demographics
- This is the same archive process used after every completed marketplace

**Step 2 — Reset checked-out cards to inactive** (frees them for re-entry)
- Set status → `inactive`, clear credit_balance, total_items_collected, collected_items, marketplace_id, activated_at
- These cards can now be scanned again for the continued distribution

**Step 3 — Remove end_time on morning marketplace**
- Set `end_time` to NULL so the auto-unblock cron won't close the session
- The marketplace continues until items run out

### What is preserved
- All 16,072 distribution transactions ✓
- All 891 checkout transactions ✓  
- Archived card snapshots in `archived_card_data` ✓
- Morning marketplace stays active with `status_locked_by_admin = true` ✓
- Afternoon event stays `completed` — untouched ✓

### No code changes needed
All three steps are data operations only.

