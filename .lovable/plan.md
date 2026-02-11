

## Send Volunteer and Beneficiary Data to Surpluss

### Overview
Build a new edge function and UI button that sends all volunteer and beneficiary information from a marketplace event to the Surpluss API, using the existing API patterns.

### Data to Send

**Volunteers** (via `POST /api/common/volunteers` for each volunteer):
- Name, email, phone
- Company association (employee vs external)
- Source: `API`
- Hours worked, check-in/check-out times

**Beneficiaries** (via `PUT /api/common/marketplace-events/:id` to update demographics):
- Total families, adults, children
- Gender breakdown (male/female adults and children)
- Nationalities
- Items collected per beneficiary (from QR card data)

**Summary stats** (via existing distribution endpoint already implemented):
- Already handled by the existing `report-surpluss-distribution` edge function

---

### Implementation Steps

**Step 1: Create a new edge function `sync-surpluss-volunteer-beneficiary`**

This function will:
1. Accept a marketplace event ID and environment (staging/production)
2. Query the local database for:
   - All volunteer QR cards + pending_volunteers data for that marketplace
   - All QR cards (beneficiary cards) with demographics for that marketplace
   - Marketplace demographics summary
3. Send each volunteer to Surpluss via `POST /api/common/volunteers`
4. Update the marketplace event on Surpluss with beneficiary demographics via `PUT /api/common/marketplace-events/:id`
5. Log results to the `surpluss_api_audit_log` table
6. Return a summary of successes/failures

**Step 2: Add a "Send to Surpluss" button in Marketplace Reports**

Add a button in the MarketplaceReports component that:
- Appears when a marketplace is selected and has an `external_id`
- Shows environment selector (staging/production)
- Triggers the edge function
- Displays progress and results via toast notifications

**Step 3: Create a frontend hook `useSurplussVolunteerBeneficiarySync`**

A hook that:
- Calls the new edge function
- Manages loading/error states
- Shows success/failure toasts

---

### Technical Details

**Edge Function: `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts`**

```text
Request payload:
{
  marketplace_id: string (local UUID),
  environment: "staging" | "production"
}

Response:
{
  success: boolean,
  volunteers_sent: number,
  volunteers_failed: number,
  beneficiary_update_success: boolean,
  errors: string[]
}
```

API calls made:
- For each volunteer: `POST {baseUrl}/api/common/volunteers` with `{ name, email, phone, source: "API" }`
- For beneficiary demographics: `PUT {baseUrl}/api/common/marketplace-events/{external_id}` with demographic fields

**Frontend hook: `src/hooks/useSurplussVolunteerBeneficiarySync.ts`**
- Wraps the edge function call
- Provides `syncToSurpluss(marketplaceId, environment)` function

**UI changes: `src/components/admin/MarketplaceReports.tsx`**
- Add a "Send to Surpluss" button in the report header area
- Environment selector dropdown
- Loading state while syncing

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts` | Create |
| `src/hooks/useSurplussVolunteerBeneficiarySync.ts` | Create |
| `src/components/admin/MarketplaceReports.tsx` | Modify - add send button |
| `supabase/config.toml` | Will auto-update for new function |

