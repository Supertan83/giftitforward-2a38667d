

## Data Cleanup Manager for Admin Dashboard

A new admin section that lets you view record counts and selectively clear test/dummy data from each table -- organized into logical categories for safe, manual cleanup before a live marketplace event.

### How It Works

The page shows data grouped into categories. Each category displays tables with their current record counts. You can select which categories (or individual tables) to clear, preview what will be deleted, then confirm with a safety prompt.

### Data Categories

**1. Beneficiary Data**
- QR Cards (78 records) -- reset all cards to inactive
- Transactions (675 records) -- clear all transaction history
- Archived Card Data (18 records) -- clear archived beneficiary records

**2. Volunteer Data**
- Volunteer QR Cards (545 records) -- clear volunteer card assignments
- Volunteer Attendance (15 records) -- clear attendance logs
- Pending Volunteers (345 records) -- clear registration queue

**3. Marketplace & Inventory**
- Marketplace Item Allocations (120 records) -- clear all allocations
- Item Types distributed counts (348 records) -- reset distributed counters to 0 (keeps item definitions)
- Manual Counts (1 record) -- clear manual count entries
- Warehouse Returns (0 records) -- clear return records
- Traceability Logs (20 records) -- clear audit trail

**4. Survey Data**
- Volunteer Surveys (6 records) -- clear volunteer survey responses
- External Survey Responses (1 record) -- clear external survey responses

**5. Communication Logs**
- Email Send Logs (421 records) -- clear email delivery logs

### Safety Features
- Live record counts displayed next to each table
- "Select All" per category or pick individual tables
- Confirmation dialog requires typing "CLEAN" to proceed
- Protected tables: marketplace_events and item_types definitions are preserved (only counters reset)
- Toast notification with summary of deleted records

### Technical Details

**New file: `src/components/admin/DataCleanupManager.tsx`**
- Component with categorized table listing
- Checkboxes per table, "Select All" per category
- Fetches live counts from each table on mount
- Calls a new edge function to perform deletions

**New file: `supabase/functions/cleanup-data/index.ts`**
- Receives an array of table names to clean
- Admin-only auth check (same pattern as cleanup-orphans)
- For each selected table, runs the appropriate DELETE or UPDATE (for counters)
- Returns count of deleted records per table
- Special handling:
  - `qr_cards`: resets status to 'inactive', clears balances (does not delete cards)
  - `item_types`: resets `distributed` and `allocated_to_marketplace` to 0 (does not delete items)
  - All other tables: DELETE all rows

**Updated: `src/components/admin/AdminSidebar.tsx`**
- Add "Data Cleanup" entry under Admin Apps with a Trash2 icon

**Updated: `src/components/admin/AdminDashboard.tsx`**
- Add 'data-cleanup' to AdminView type
- Add case in renderContent to show DataCleanupManager

### What Stays Safe
- Marketplace event definitions are never deleted (only allocations are cleared)
- Item type definitions are never deleted (only distributed/allocated counters reset)
- User accounts and roles are not touched (use existing User Management for that)
- Tala's Marketplace and Lea's Marketplace are explicitly preserved per existing constraints

