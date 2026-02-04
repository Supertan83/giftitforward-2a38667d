

## Marketplace Events Cleanup Plan

### Events from Official Document (DH_20260116_-_GIF_Volunteer_Events_-_Final.docx)

Here are the **official 24 event sessions** from the Dubai Holding document:

| # | Event Name | Date | Time Slot | Location |
|---|------------|------|-----------|----------|
| 1 | Young Dreamers: Boys' Community School Marketplace | Feb 19, 2026 | 7:00AM – 1:30PM | Ajman, Al Hamidya |
| 2 | Stronger Together: Emirati Family Community Marketplace | Feb 21, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 3 | Stronger Together: Emirati Family Community Marketplace | Feb 22, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 4 | Stronger Together: Emirati Family Community Marketplace | Feb 23, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 5 | Stronger Together: Emirati Family Community Marketplace | Feb 24, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 6 | Stronger Together: Emirati Family Community Marketplace | Feb 25, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 7 | Stronger Together: Emirati Family Community Marketplace | Feb 26, 2026 | 7:30PM – 11:30PM | Dubai, Al Twar |
| 8 | She Thrives: Women Workers Marketplace | Feb 28, 2026 | 7:30AM – 4:30PM | Dubai, Muhaisnah 2 |
| 9 | She Thrives: Women Workers Marketplace | Feb 28, 2026 | 7:30PM – 11:30PM | Dubai, Muhaisnah 2 |
| 10 | Hard Hat Heroes: Men's Construction and Facility Workers Marketplace | Mar 1, 2026 | 7:30AM – 4:30PM | Dubai, Muhaisnah 2 |
| 11 | Hard Hat Heroes: Men's Construction and Facility Workers Marketplace | Mar 1, 2026 | 7:30PM – 11:30PM | Dubai, Muhaisnah 2 |
| 12 | Bright Futures: Girls' Community School Marketplace | Mar 4, 2026 | 7:00AM – 1:30PM | Sharjah, Al Azra |
| 13 | Supporting Our Driving Force: Taxi Drivers' Marketplace | Mar 4, 2026 | 7:30PM – 11:30PM | Dubai, Muhaisnah 4 |
| 14 | Supporting Our Driving Force: Taxi Drivers' Marketplace | Mar 5, 2026 | 7:30AM – 4:30PM | Dubai, Muhaisnah 4 |
| 15 | Supporting Our Driving Force: Taxi Drivers' Marketplace | Mar 5, 2026 | 7:30PM – 11:30PM | Dubai, Muhaisnah 4 |
| 16 | She Thrives: Women Workers Marketplace | Mar 7, 2026 | 7:30AM – 4:30PM | Dubai, Al Quoz |
| 17 | She Thrives: Women Workers Marketplace | Mar 7, 2026 | 7:30PM – 11:30PM | Dubai, Al Quoz |
| 18 | Hard Hat Heroes: Men's Factory Workers Marketplace | Mar 8, 2026 | 8:00AM – 4:30PM | Ras Al Khaimah |
| 19 | Hard Hat Heroes: Men's Factory Workers Marketplace | Mar 8, 2026 | 8:00PM – 11:30PM | Ras Al Khaimah |
| 20 | Strong Foundations: Construction Workers Community Marketplace | Mar 10, 2026 | 7:30AM – 4:30PM | Dubai, Jebel Ali |
| 21 | Strong Foundations: Construction Workers Community Marketplace | Mar 11, 2026 | 7:30AM – 4:30PM | Dubai, Jebel Ali |
| 22 | Strong Foundations: Construction Workers Community Marketplace | Mar 12, 2026 | 7:30AM – 4:30PM | Dubai, Jebel Ali |
| 23 | Inclusive Community: Family and People of Determination Marketplace | Mar 12, 2026 | 7:30PM – 11:30PM | Dubai, Muhaisnah 2 |
| 24 | Stronger Together: Single Mothers and Household Workers Marketplace | Mar 14, 2026 | 7:30AM – 4:30PM | Dubai, Al Qusais 3 |
| 25 | Stronger Together: Single Mothers and Household Workers Marketplace | Mar 14, 2026 | 7:30PM – 11:30PM | Dubai, Al Qusais 3 |
| 26 | Stronger Together: Single Mothers and Household Workers Marketplace | Mar 15, 2026 | 7:30AM – 4:30PM | Dubai, Al Qusais 3 |
| 27 | Stronger Together: Single Mothers and Household Workers Marketplace | Mar 15, 2026 | 7:30PM – 11:30PM | Dubai, Al Qusais 3 |

---

### Current Events in Database (To Be Cleaned Up)

Some events that appear **unnecessary** or are duplicates/old:

- **CDA Day 1** / **CDA Day 2** - Old naming, should be renamed or removed
- **Ejadah** - Generic name, incomplete
- **Twar Hall** - Generic name, incomplete
- **Smartlife** - Generic name, incomplete
- **PJA** - Generic name, incomplete
- **Lea's Marketplace** - Test data?
- **Tala's Marketplace** - Test data?
- **National Charity School for Boys** (2025) - Old event, already completed
- **FSC** (2025) - Old event, already completed

---

### Implementation Plan

#### Step 1: Add Bulk Delete Feature to Marketplace Management

Enhance the existing `MarketplaceManagement.tsx` component to support:
- **Checkbox selection** for multiple events
- **"Delete Selected" button** for bulk deletion
- **Status filter** to easily find events to clean up

#### Step 2: UI Changes

**File:** `src/components/admin/MarketplaceManagement.tsx`

Add:
1. State for selected marketplace IDs
2. Checkbox column in the list
3. "Select All" checkbox in header
4. "Delete Selected" button with count badge
5. Filter tabs (All / Upcoming / Active / Completed)

```text
+------------------------------------------+
| Marketplace Events                       |
|------------------------------------------|
| [Filter: All | Upcoming | Active | Done] |
|------------------------------------------|
| [x] Select All    [ Delete Selected (3) ]|
|------------------------------------------|
| [ ] Young Dreamers: Boys'...  Feb 19     |
| [x] CDA Day 1                 Feb 19 [x] |
| [x] Ejadah                    Jan 6  [x] |
| [x] Smartlife                 Jan 6  [x] |
+------------------------------------------+
```

#### Step 3: Confirmation Dialog

Before bulk deletion, show a confirmation dialog listing all selected events to prevent accidental deletion.

---

### Technical Details

**New state variables:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all');
```

**Checkbox toggle handler:**
```typescript
const toggleSelection = (id: string) => {
  const newSet = new Set(selectedIds);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  setSelectedIds(newSet);
};
```

**Bulk delete handler:**
```typescript
const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.size} events?`)) return;
  
  for (const id of selectedIds) {
    await deleteMarketplace.mutateAsync(id);
  }
  setSelectedIds(new Set());
};
```

---

### Files to Modify

1. **`src/components/admin/MarketplaceManagement.tsx`**
   - Add checkbox selection UI
   - Add status filter tabs
   - Add bulk delete button and handler
   - Add confirmation dialog for bulk actions

