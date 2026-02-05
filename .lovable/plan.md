
## Marketplace Operations Enhancement Plan

This plan addresses 7 key operational requirements for managing item allocations, beneficiary credits, outreach partners, and volunteer tracking across marketplace events.

---

### Requirements Summary

| # | Requirement | Priority |
|---|-------------|----------|
| 1 | Dynamic editing of item quantities and credits per marketplace day | High |
| 2 | Edit distributed item counts after marketplace events | High |
| 3 | Adjustable per-marketplace allocation (total constant, per-event flexible) | High |
| 4 | Track items returned to warehouse with QR codes for redistribution | Medium |
| 5 | Edit beneficiary item credits per marketplace (15 → 20 or 25) | High |
| 6 | Outreach partner dropdown (single-select, ~10 partners) | Medium |
| 7 | Synchronize volunteer data (sign-ups, attendance, company breakdowns) | Medium |

---

### Feature 1: Edit Allocated & Distributed Quantities

**Current State:** The `AllocationManagement.tsx` shows allocations but only allows adding more, not editing existing values.

**Solution:** Add inline editing for both allocated and distributed quantities in the allocation view.

**Files to Modify:**
- `src/components/admin/AllocationManagement.tsx` - Add edit mode with input fields

**UI Changes:**
```text
+---------------------------------------------+
| Distribution Progress         [Edit] button |
| 450 / 1,000                                |
|                                             |
| [Edit Mode]                                 |
| Allocated:   [____1000____]                 |
| Distributed: [_____450____]                 |
| [Cancel] [Save]                             |
+---------------------------------------------+
```

**Implementation:**
```typescript
// Add state for editing
const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
const [editAllocated, setEditAllocated] = useState<number>(0);
const [editDistributed, setEditDistributed] = useState<number>(0);

// Use existing updateAllocationQuantities mutation from useMarketplaceAllocations
const { updateAllocationQuantities } = useAllocationOperations();

const handleSaveEdit = async () => {
  await updateAllocationQuantities.mutateAsync({
    allocationId: editingAllocationId,
    allocatedQuantity: editAllocated,
    distributedQuantity: editDistributed
  });
  setEditingAllocationId(null);
};
```

---

### Feature 2: Beneficiary Credit Limit Per Marketplace

**Current State:** Credit limit is hardcoded to 15 in multiple places.

**Solution:** Add `beneficiary_credit_limit` column to `marketplace_events` table and reference it dynamically.

**Database Migration:**
```sql
ALTER TABLE marketplace_events 
ADD COLUMN beneficiary_credit_limit INTEGER NOT NULL DEFAULT 15;
```

**Files to Modify:**
1. `src/components/admin/MarketplaceManagement.tsx` - Add credit limit field in create/edit forms
2. `src/components/zones/EntranceZone.tsx` - Use marketplace credit limit instead of hardcoded 15
3. `src/components/zones/MarketplaceZone.tsx` - Display dynamic limit in feedback
4. `src/hooks/useSupabaseData.ts` - Include credit limit in marketplace queries

**UI in Marketplace Management:**
```text
+----------------------------------------+
| Beneficiary Credit Limit               |
| [____15____] items per beneficiary     |
| (Default: 15, can be 15-25)           |
+----------------------------------------+
```

---

### Feature 3: Outreach Partner Dropdown

**Current State:** Outreach partner is a free-text field.

**Solution:** Create a managed list of partners and use a dropdown selector.

**Database Migration:**
```sql
CREATE TABLE outreach_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE outreach_partners ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage outreach partners" ON outreach_partners
  FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view outreach partners" ON outreach_partners
  FOR SELECT USING (is_staff(auth.uid()));

-- Insert initial partners (to be populated by admin)
INSERT INTO outreach_partners (name) VALUES 
  ('Partner 1'),
  ('Partner 2');
```

**Files to Modify:**
1. `src/hooks/useSupabaseData.ts` - Add `useOutreachPartners` query
2. `src/components/admin/MarketplaceManagement.tsx` - Replace text input with Select dropdown
3. New component: `src/components/admin/OutreachPartnerManager.tsx` - CRUD for partners

**UI in Marketplace Edit:**
```text
+----------------------------------------+
| Outreach Partner                       |
| [▼ Select Partner...                 ] |
|   ○ Dubai Cares                        |
|   ○ Red Crescent                       |
|   ○ Emirates Foundation                |
|   ○ + Add New Partner                  |
+----------------------------------------+
```

---

### Feature 4: Warehouse Return Tracking

**Current State:** Remaining items after marketplace are tracked in `marketplace_item_allocations.distributed_quantity`, but there's no explicit "returned to warehouse" tracking.

**Solution:** Add a "Return to Warehouse" feature that:
1. Records returned quantities with optional QR/batch ID
2. Updates allocation to show what was returned vs consumed

**Database Migration:**
```sql
CREATE TABLE warehouse_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id UUID NOT NULL REFERENCES marketplace_events(id),
  allocation_id UUID REFERENCES marketplace_item_allocations(id),
  item_type_id UUID NOT NULL REFERENCES item_types(id),
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  return_batch_code TEXT,
  notes TEXT,
  returned_by UUID REFERENCES auth.users(id),
  returned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE warehouse_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage warehouse returns" ON warehouse_returns
  FOR ALL USING (is_staff(auth.uid()));
```

**Files to Create/Modify:**
1. New component: `src/components/admin/WarehouseReturnPanel.tsx`
2. `src/hooks/useWarehouseReturns.ts` - Queries and mutations
3. `src/components/admin/AllocationManagement.tsx` - Add "Return to Warehouse" button

**UI:**
```text
+---------------------------------------------+
| Return Items to Warehouse                   |
|---------------------------------------------|
| Marketplace: [▼ Select completed event    ] |
| Item Type: Warehouse Stock                  |
| Remaining: 347 items                        |
|                                             |
| Quantity to Return: [____347____]           |
| Batch/QR Code: [________________] (optional)|
| Notes: [________________________]           |
|                                             |
| [Cancel] [Confirm Return]                   |
+---------------------------------------------+
```

---

### Feature 5: Volunteer Data Synchronization

**Current State:** `VolunteerTrackingSection.tsx` calculates sign-ups by fuzzy-matching marketplace names to `events_list` strings, which can be unreliable.

**Solution:** Improve the matching logic and add a summary view in Marketplace Reports.

**Files to Modify:**
1. `src/components/admin/VolunteerTrackingSection.tsx` - Improve matching logic
2. `src/components/admin/MarketplaceReports.tsx` - Add volunteer tracking section with:
   - Total sign-ups
   - Actual attendance
   - Attendance rate
   - Company breakdown (external partners)
   - Vertical breakdown (Dubai Holding employees)

**Enhanced Matching Logic:**
```typescript
// Match by multiple criteria:
// 1. Exact marketplace ID in events_json
// 2. Marketplace external_id match
// 3. Event slug contains marketplace keywords + date

const isRegisteredForMarketplace = (volunteer, marketplace) => {
  // Check events_json array for matching event
  const eventsJson = volunteer.events_json || [];
  for (const event of eventsJson) {
    // Check if event date matches marketplace date
    const eventDate = parseEventDate(event.eventDate);
    if (eventDate && marketplace.event_date) {
      const mpDate = new Date(marketplace.event_date);
      if (eventDate.getTime() === mpDate.getTime()) {
        // Also check name keywords
        if (slugMatchesMarketplace(event.event, marketplace.name)) {
          return true;
        }
      }
    }
  }
  return false;
};
```

---

### Feature 6: Marketplace Reports Volunteer Section

Add a collapsible volunteer section to the detailed marketplace report view.

**Files to Modify:**
- `src/components/admin/MarketplaceReports.tsx` - Integrate `VolunteerTrackingSection`

**UI Addition:**
```text
+---------------------------------------------+
| Volunteer Tracking              [▼ Expand]  |
|---------------------------------------------|
| Registered: 45    |    Attended: 38         |
|                                             |
| Attendance Rate: 84%  ████████████░░░       |
|                                             |
| Dubai Holding: 25 (66%)                     |
| External Partners: 13 (34%)                 |
|                                             |
| Company Breakdown:                          |
| ┌──────────────┬──────┐                    |
| │ ENOC         │  5   │                    |
| │ DP World     │  4   │                    |
| │ Emaar        │  4   │                    |
| └──────────────┴──────┘                    |
|                                             |
| Vertical Breakdown (DH):                    |
| ┌──────────────┬──────┐                    |
| │ Asset Mgmt   │  12  │                    |
| │ Real Estate  │  8   │                    |
| │ Entertainment│  5   │                    |
| └──────────────┴──────┘                    |
+---------------------------------------------+
```

---

### Implementation Order

| Phase | Features | Files |
|-------|----------|-------|
| **1** | Database migrations | `supabase/migrations/` |
| **2** | Beneficiary credit limit (Feature 5) | `MarketplaceManagement.tsx`, `EntranceZone.tsx`, `MarketplaceZone.tsx` |
| **3** | Allocation editing (Features 1-3) | `AllocationManagement.tsx` |
| **4** | Outreach partners dropdown (Feature 6) | `MarketplaceManagement.tsx`, new hooks |
| **5** | Warehouse returns (Feature 4) | New `WarehouseReturnPanel.tsx` |
| **6** | Volunteer sync improvements (Feature 7) | `VolunteerTrackingSection.tsx`, `MarketplaceReports.tsx` |

---

### Database Schema Changes Summary

```sql
-- 1. Add beneficiary credit limit to marketplace_events
ALTER TABLE marketplace_events 
ADD COLUMN beneficiary_credit_limit INTEGER NOT NULL DEFAULT 15;

-- 2. Create outreach_partners table
CREATE TABLE outreach_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create warehouse_returns table
CREATE TABLE warehouse_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id UUID NOT NULL REFERENCES marketplace_events(id),
  allocation_id UUID REFERENCES marketplace_item_allocations(id),
  item_type_id UUID NOT NULL REFERENCES item_types(id),
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  return_batch_code TEXT,
  notes TEXT,
  returned_by UUID REFERENCES auth.users(id),
  returned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Files to Create

1. `src/components/admin/OutreachPartnerManager.tsx` - CRUD for outreach partners
2. `src/components/admin/WarehouseReturnPanel.tsx` - Return items to warehouse
3. `src/hooks/useWarehouseReturns.ts` - Queries and mutations for returns

### Files to Modify

1. `src/components/admin/AllocationManagement.tsx` - Inline editing for allocations
2. `src/components/admin/MarketplaceManagement.tsx` - Credit limit field, partner dropdown
3. `src/components/zones/EntranceZone.tsx` - Dynamic credit limit from marketplace
4. `src/components/zones/MarketplaceZone.tsx` - Dynamic credit limit display
5. `src/components/admin/MarketplaceReports.tsx` - Add volunteer section
6. `src/components/admin/VolunteerTrackingSection.tsx` - Improve matching
7. `src/hooks/useSupabaseData.ts` - Add partner queries, update marketplace type
8. `src/hooks/useMarketplaceAllocations.ts` - Already has `updateAllocationQuantities`
