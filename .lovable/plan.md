

# Fix: Hardcoded "0/15" Credit Display in QR Code Generator

## Problem

In the **Registered Cards** tab of the QR Code Generator, every card shows its credit balance as `{creditBalance}/15`. The `/15` denominator is hardcoded and does not reflect the actual marketplace credit limit. If a marketplace is configured with a 25-item limit, the display still shows `/15`, which is misleading for admins.

## Solution

Replace the hardcoded `15` with the actual `beneficiary_credit_limit` from the card's assigned marketplace. Since cards may belong to different marketplaces (or none), the fix needs to resolve the limit per card.

## Technical Details

### File: `src/components/admin/RegisteredCardsList.tsx`

**Change 1 — Accept credit limit context**

Add an optional prop to pass marketplace credit limits so the component can resolve the correct denominator per card:

```typescript
interface RegisteredCardsListProps {
  // ... existing props
  defaultCreditLimit?: number; // from active/selected marketplace
}
```

**Change 2 — Use dynamic limit in display (line 115)**

Replace:
```
{card.creditBalance}/15
```
With:
```
{card.creditBalance}/{defaultCreditLimit || 15}
```

### File: `src/components/admin/QRCodeGenerator.tsx`

**Change — Pass the active marketplace credit limit**

The QR Code Generator already has access to marketplace data. Pass the current marketplace's `beneficiary_credit_limit` down to `RegisteredCardsList`:

- Fetch or use the currently selected/active marketplace's credit limit
- Pass it as the `defaultCreditLimit` prop

### Scope

| File | Change |
|------|--------|
| `src/components/admin/RegisteredCardsList.tsx` | Accept `defaultCreditLimit` prop, use it instead of hardcoded `15` |
| `src/components/admin/QRCodeGenerator.tsx` | Pass active marketplace credit limit to `RegisteredCardsList` |

This is a minimal, non-breaking change — the prop defaults to `15` if no marketplace is selected, preserving current behavior.

