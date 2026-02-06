
## Add Traceability Logs for QR Card / Item Allocation Lifecycle

Track every allocation action across marketplaces with full audit trail including timestamps, marketplace names, quantities, and the user who performed each action.

### Step 1: Create Database Table

Create a new `allocation_traceability_logs` table via migration:

```text
Columns:
- id (uuid, PK)
- card_unique_id (text, nullable) -- for QR card-level tracing
- allocation_id (uuid, nullable) -- for item allocation-level tracing  
- item_type_id (uuid, nullable)
- marketplace_id (uuid, nullable)
- marketplace_name (text) -- denormalized for historical accuracy
- action_type (text) -- e.g. 'allocated', 'distributed', 'returned_to_warehouse', 're-allocated', 'archived', 'reset', 'synced_to_inventory', 'consumed'
- quantity_before (integer)
- quantity_after (integer)
- description (text) -- human-readable summary of what happened
- performed_by (uuid, nullable) -- user who did the action
- performed_by_email (text, nullable) -- denormalized
- created_at (timestamptz, default now())
```

RLS: Admins can manage, staff can view (matching existing patterns).

### Step 2: Create a Hook for Traceability Logging

Add a `useTraceabilityLogs` hook in a new file `src/hooks/useTraceabilityLogs.ts`:
- `logTraceabilityEvent()` mutation to insert a log entry (auto-captures current user)
- `useTraceabilityLogsByCard(cardUniqueId)` query to fetch logs for a specific QR card
- `useTraceabilityLogsByAllocation(allocationId)` query for a specific allocation
- `useAllTraceabilityLogs(filters)` query with optional marketplace/action filters

### Step 3: Instrument Existing Operations

Add traceability log calls at these action points:

**In `AllocationManagement.tsx`:**
- `handleAllocate` -- log "Items allocated to marketplace"
- `handleUndo` -- log "Items returned to warehouse"
- `handleReallocate` -- log two entries: "Items removed from source" + "Items re-allocated to target"
- `handleDistribute` -- log "Item distributed"
- `handleSaveEdit` -- log "Allocation quantities edited"
- `handleDelete` -- log "Allocation removed"

**In `MarketplaceSyncPanel.tsx`:**
- `handleArchiveAndReset` -- log "Cards archived and reset for reuse"
- `handleResetAll` -- log "All cards reset (no archive)"

### Step 4: Build Traceability Viewer UI

Create `src/components/admin/TraceabilityLogsViewer.tsx`:
- Full-page admin panel accessible from the sidebar
- Filter by marketplace, action type, date range, or QR card ID
- Table showing: Timestamp, Action, Marketplace, QR Card / Item, Qty Before -> After, Performed By, Description
- Color-coded action badges (green for allocations, amber for returns, red for resets, blue for distributions)
- Timeline view option for a specific QR card showing its full lifecycle journey

### Step 5: Register in Admin Navigation

- Add `'traceability-logs'` to the `AdminView` type in `AdminDashboard.tsx`
- Add sidebar entry under an appropriate section (e.g., near Marketplace Reports)
- Render `TraceabilityLogsViewer` when that view is active

### Technical Details

- The `performed_by` and `performed_by_email` fields are captured from `supabase.auth.getUser()` at log-write time
- Marketplace name is denormalized (stored as text) so logs remain accurate even if the marketplace is renamed later
- The description field provides a human-readable sentence for each log entry matching the example flow format
- Logs are append-only; no update or delete operations from the UI
