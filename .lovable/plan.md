

# Fix: Per-Marketplace Volunteer Hours Tracking

## Problem

Currently, volunteer hours are tracked as a single cumulative number on `volunteer_qr_cards.total_hours_worked`. When the same volunteer participates in multiple marketplace events, their hours get added together. Reports then show this cumulative total for every marketplace, which is incorrect.

Additionally, `volunteer_qr_cards.marketplace_id` only stores the **last** marketplace the volunteer was checked into, so a volunteer who worked at Marketplace A and later Marketplace B only appears in Marketplace B's report.

## Root Cause

The marketplace report (`useMarketplaceReport`) queries `volunteer_qr_cards` filtered by `marketplace_id`, then reads `card.total_hours_worked`. This means:
- Volunteers only appear under their **most recent** marketplace
- Hours shown are the **lifetime total**, not marketplace-specific

## Solution

The `volunteer_attendance` table already has per-marketplace records with individual `hours_worked` values. The fix is to use attendance records as the source of truth for marketplace reports instead of relying on the card-level data.

## Changes

### 1. Marketplace Report Query (src/hooks/useMarketplaceAllocations.ts)

**Current approach (line ~414-420):**
- Fetches `volunteer_qr_cards` where `marketplace_id = marketplaceId`
- Uses `card.total_hours_worked` for hours

**New approach:**
- Fetch `volunteer_attendance` records where `marketplace_id = marketplaceId`
- Join to `volunteer_qr_cards` (to get `volunteer_id`) and then to `pending_volunteers` (for name, company, gender)
- Use `attendance.hours_worked` for per-event hours
- If a volunteer has multiple attendance records for the same marketplace (re-checked-in), sum them
- This ensures volunteers appear in every marketplace they attended, with correct per-event hours

### 2. Volunteer List Building (line ~433-458)

Update the volunteer list construction to:
- Group attendance records by `volunteer_card_id`
- Sum `hours_worked` across all attendance records for that volunteer at that marketplace
- Use `check_in_time` and `check_out_time` from the attendance record (not the card) for the report display
- Keep category logic (Corporate Internal/External/Outreach) unchanged

### 3. Total Hours Calculation (line ~420)

Replace:
```text
totalHours = sum of card.total_hours_worked  (cumulative across all events)
```
With:
```text
totalHours = sum of attendance.hours_worked  (only this marketplace)
```

### 4. Hours Edit Dialog Compatibility

The `VolunteerHoursEditDialog` currently updates `volunteer_qr_cards` timestamps and recalculates hours. It will also need to update the corresponding `volunteer_attendance` record to keep both in sync.

## What Does NOT Change

- The check-in/check-out flow (already creates attendance records correctly)
- The `volunteer_qr_cards.total_hours_worked` field (still useful as a lifetime total)
- Admin dashboard volunteer cards viewer
- Certificate generation (already receives hours as a parameter)

## Data Flow After Fix

```text
Check-in:  Creates volunteer_attendance record with marketplace_id + check_in_time
Check-out: Updates attendance record with check_out_time + hours_worked
Report:    Queries volunteer_attendance by marketplace_id -> accurate per-event data
```

