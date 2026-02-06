

## Admin Dashboard -- Sidebar Navigation

Replace the current collapsible category cards with a persistent sidebar that gives instant access to all admin views.

---

### Current State

The dashboard uses collapsible accordion-style sections (Volunteer Apps, Beneficiary Apps, Admin Apps) with icon buttons inside each. Navigating requires: expand a category, then click the button. All sub-views use a full-page takeover pattern with an "onBack" callback.

### Proposed Layout

```text
+----------------------------------------------------------+
| Header: GIF Logo + Admin Dashboard        [Sign Out]     |
+-------+--------------------------------------------------+
|       |                                                  |
| Side  |   Main Content Area                              |
| bar   |   (renders the selected view)                    |
|       |                                                  |
| [<>]  |   - Dashboard home (stats/overview)              |
|       |   - Or any sub-view (Volunteers, Marketplaces,   |
|       |     Inventory, Users, etc.)                       |
|       |                                                  |
+-------+--------------------------------------------------+
```

- Sidebar collapses to icon-only (mini) mode on mobile or when toggled
- Active route is highlighted
- Groups remain (Volunteer, Beneficiary, Admin) but as sidebar sections with expandable menus
- Sub-views render inline in the main content area instead of full-page takeover

---

### Technical Approach

**Files to Modify:**
1. `src/components/admin/AdminDashboard.tsx` -- Major refactor:
   - Wrap in `SidebarProvider`
   - Extract navigation into a new `AdminSidebar` component
   - Replace the collapsible card grid with sidebar menu items
   - Keep the header but add `SidebarTrigger`
   - Remove all the `if (currentView === '...')` full-page returns; render selected view in the main content area instead

2. **New file:** `src/components/admin/AdminSidebar.tsx`
   - Uses shadcn `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
   - Three groups: Volunteer Apps, Beneficiary Apps, Admin Apps
   - Each group lists its items with icons
   - Highlights the active view
   - Collapsible to mini (icon-only) mode

**No other files need changes** -- all sub-views (UserManagement, MarketplaceManagement, etc.) already accept an `onBack` prop and render standalone content. They will continue to work, just rendered inside the sidebar layout instead of as full-page replacements.

---

### Sidebar Menu Structure

**Volunteer Apps**
- Volunteers Added (UserPlus, orange)
- Bulk Upload (Upload, teal)
- Volunteer QR Cards (UserCheck, blue)
- Training Completion (Award, emerald)
- Training Module (GraduationCap, indigo) -- navigates to /training
- Training Assessments (FileQuestion, purple)

**Beneficiary Apps**
- Generate QR Cards (QrCode, primary)
- Marketplaces (Store, amber)
- Marketplace Reports (PieChart, indigo)
- Sync & Reset Cards (RefreshCw, rose)
- Auto-Unblock Cards (Unlock, warning) -- action button

**Admin Apps**
- Manage Inventory (Package)
- Allocate Items (TrendingUp, teal)
- Live Statistics (TrendingUp, emerald)
- Manage Users (Users, violet)
- Webhook Events (Webhook, cyan)
- External Items (Database, teal)
- Surpluss Sync (Database, cyan)
- Sync to HubSpot (CloudUpload, orange) -- action button
- Email Config (Mail)
- Email Logs (Mail)
- Email Management (Mail)

---

### Key Design Decisions

- **Mini collapse**: When collapsed, sidebar shows only icons (w-14), with a `SidebarTrigger` always visible in the header
- **Mobile**: Sidebar acts as a slide-out drawer on screens < 768px
- **Dashboard home**: When no sub-view is selected, show the "Distribution by Marketplace" table and any quick stats (can re-enable the stats cards here)
- **Action buttons** (Auto-Unblock, HubSpot Sync): These stay as clickable items in the sidebar but trigger actions instead of navigation
- **Header stays global**: Logo, title, and Sign Out button remain in the top header bar outside the sidebar

---

### Implementation Steps

1. Create `AdminSidebar.tsx` with all menu groups and items using shadcn sidebar components
2. Refactor `AdminDashboard.tsx`:
   - Wrap layout in `SidebarProvider`
   - Move header outside sidebar, add `SidebarTrigger`
   - Replace collapsible card sections with the sidebar
   - Render selected view in the main content area using the existing `currentView` state
   - Keep all existing handlers and state logic intact
3. Style sidebar groups with brand colors (DH Red primary, matching existing icon colors)
4. Ensure high contrast for field deployment readability

