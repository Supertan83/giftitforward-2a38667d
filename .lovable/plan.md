

# Fix Family Member Name Resolution

## Problem

Family member names are mismatched across the Send Family Certs dialog, the Family Members tab, and the expanded volunteer rows. Two bugs are causing this:

### Bug 1: Greedy Regex Capturing Wrong Index

QR card IDs are generated as `VOL-xxx-F{index}{2_random_chars}` where `index` is a single digit (1-9). For example:
- `F14R` = index **1** + random "4R"
- `F242` = index **2** + random "42"
- `F3Z3` = index **3** + random "Z3"

But the current regex `/-F(\d+)/` greedily captures all consecutive digits, so:
- `F14R` is parsed as index **14** (wrong, should be 1)
- `F242` is parsed as index **242** (wrong, should be 2)

This causes the index-based name lookup to fail or return the wrong name.

### Bug 2: Inconsistent Deduplication Logic

The `extractUniqueDependents` function in `FamilyMembersTab.tsx` uses substring matching to merge similar names (e.g., "June Carla Daniel" and "June Carla P. Daniel" are treated as one person). This produces only 4 unique dependents when 6 QR cards were actually created using exact-match deduplication. This mismatch leaves 2 cards without resolvable names.

## Solution

### 1. Fix regex in all name resolution code
Change from `/-F(\d+)/` to `/-F(\d)/` (capture exactly one digit) in:

- **PendingVolunteers.tsx** -- Send Family Certs dialog (line ~3299)
- **PendingVolunteers.tsx** -- Expanded volunteer sub-rows (lines ~1850, 1855)
- **PendingVolunteers.tsx** -- Sorting family cards (line ~1850)
- **FamilyMembersTab.tsx** -- `resolveFamilyMemberName` function (lines ~70, 76, 82)

### 2. Align deduplication logic in FamilyMembersTab.tsx
Replace the substring-based `extractUniqueDependents` in `FamilyMembersTab.tsx` with exact-match logic (matching the `PendingVolunteers.tsx` version that uses a Map with lowercased name keys). This ensures the dependent count matches the actual QR cards that were generated.

### 3. Fix the detail view regex
The volunteer details view (line ~2080) uses `/-F(\d)[A-Z0-9]+$/` which already captures a single digit -- this is correct and needs no change.

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/PendingVolunteers.tsx` | Fix `/-F(\d+)/` to `/-F(\d)/` in ~4 locations (Send Family Certs dialog, expanded rows, sorting) |
| `src/components/admin/FamilyMembersTab.tsx` | Fix regex + replace substring dedup with exact-match dedup |

## What Does NOT Change

- QR card generation logic (already correct)
- Certificate PDF generation
- Email sending logic
- Check-in/check-out flows
- The volunteer detail view (already uses correct single-digit regex)

