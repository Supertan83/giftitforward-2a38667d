

## Plan: Classify Ejadah as Internal (Dubai Holding subsidiary)

### Issue
Volunteers from **Ejadah** (a Dubai Holding subsidiary) currently appear under "Corporate External" because they have `is_employee = false` and `external_company = 'Ejadah'`. The classification logic only checks `is_employee` to decide internal vs. external.

Live DB confirms 9 Ejadah volunteers (8 with `is_employee=false`, 1 with `is_employee=true`).

### Approach

Treat a configurable list of "Dubai Holding family" company names as **internal** regardless of the `is_employee` flag. Start with:
- `Ejadah`

### Changes

**1. Shared helper** — new file `src/lib/volunteerClassification.ts`
```ts
export const DH_INTERNAL_COMPANIES = ['ejadah']; // lowercase

export const isInternalCompany = (companyName?: string | null): boolean => {
  if (!companyName) return false;
  return DH_INTERNAL_COMPANIES.includes(companyName.trim().toLowerCase());
};

export const classifyVolunteer = (vol: { is_employee?: boolean; external_company?: string | null }) => {
  if (vol.is_employee || isInternalCompany(vol.external_company)) {
    return { categoryKey: 'Corporate Internal', classification: 'internal' as const };
  }
  if (vol.external_company) {
    return { categoryKey: 'Corporate External', classification: 'external' as const };
  }
  return { categoryKey: 'Outreach Partners', classification: 'outreach' as const };
};

export const resolveCompanyName = (vol: { is_employee?: boolean; external_company?: string | null }) => {
  if (vol.is_employee && !vol.external_company) return 'Dubai Holding';
  return vol.external_company || 'Other';
};
```

**2. Use the helper in the 3 places that classify volunteers:**
- `src/hooks/useVolunteerDetails.ts` (lines 124–164) — replace inline `if (vol.is_employee)` block.
- `src/hooks/useMarketplaceAllocations.ts` (lines 628–637 and 696–704) — replace both inline blocks.
- `src/components/admin/PendingVolunteers.tsx` (lines 1275, 1901, 2366) — display "Dubai Holding" for Ejadah rows too via `resolveCompanyName` (optional polish; keeps the Company column showing "Ejadah" if preferred — see Open question below).

**3. No DB change.** The fix is purely classification logic; we don't mutate `is_employee` or `external_company` so the original company name stays visible/exportable.

### Result
- Ejadah volunteers move from "Corporate External" → "Corporate Internal" in:
  - Volunteer Details stats (registered/attended/dropout per category)
  - Marketplace Reports volunteer breakdown
  - Statistics dashboard category counts
- CSV exports and tooltips keep the literal company name "Ejadah" so the source is still traceable.
- Adding more DH subsidiaries later = one-line change in `DH_INTERNAL_COMPANIES`.

### Open question (optional)
Should the **Company column** for Ejadah rows display "Ejadah" (current) or "Dubai Holding — Ejadah"? Default plan = keep "Ejadah" so admins still see the subsidiary name; only the *category* moves to Internal.

