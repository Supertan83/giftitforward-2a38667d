

## Remove "(Manual)" Label from Beneficiary Count

### Problem
When `manual_beneficiary_count` is set (as we just did for the morning event), the UI shows "Beneficiaries (Manual)" — the user doesn't want this distinction visible.

### Changes

**File 1: `src/components/admin/MarketplaceManualDataEditor.tsx` (line 288)**
- Change `"Beneficiaries (Manual)"` → `"Beneficiaries"`

**File 2: `src/components/admin/MarketplaceReports.tsx` (line 212)**
- Change the conditional label: always show `"Beneficiaries"` instead of `"Beneficiaries (Manual)"`

Two single-line text changes, no logic changes.

