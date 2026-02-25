

# Fix: Registered QR Cards Credit Limit Not Reading from Marketplace Data

## Problem

The "Registered Cards" tab shows `0/15` because the `activeCreditLimit` logic in `QRCodeGenerator.tsx` only looks for a marketplace with `status === 'active'`. When no marketplace is currently active (all are `upcoming`), it falls back to hardcoded `15`.

Currently all your marketplaces have `beneficiary_credit_limit` set to `15`, so the displayed value happens to be correct -- but the logic is broken and would show the wrong number if a marketplace had a different limit (e.g., 25).

## Fix

**File: `src/components/admin/QRCodeGenerator.tsx` (line 113-116)**

Update `activeCreditLimit` to use a smarter fallback chain:

1. First, look for an **active** marketplace
2. If none, find the **nearest upcoming** marketplace (sorted by event date)
3. Only fall back to `15` if no marketplaces exist at all

```text
Before:
  const active = marketplaces.find(m => m.status === 'active');
  return active?.beneficiary_credit_limit || 15;

After:
  const active = marketplaces.find(m => m.status === 'active');
  if (active?.beneficiary_credit_limit) return active.beneficiary_credit_limit;

  const upcoming = marketplaces
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  if (upcoming.length > 0 && upcoming[0].beneficiary_credit_limit)
    return upcoming[0].beneficiary_credit_limit;

  return 15; // absolute last resort fallback
```

## Scope

| File | Change |
|------|--------|
| `src/components/admin/QRCodeGenerator.tsx` | Update `activeCreditLimit` logic (lines 113-116) to check upcoming marketplaces when no active one exists |

Single file, ~8 lines changed. No database changes needed.

