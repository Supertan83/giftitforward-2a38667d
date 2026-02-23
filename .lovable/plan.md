

# Add "or" Divider Between Date Range and Marketplace Filter

## What Changes

**File: `src/components/admin/PendingVolunteers.tsx` (line 2722-2724)**

Add a visual "or" divider between the End Date field and the Marketplace dropdown, so users understand these are alternative filtering methods:

- Use date range to filter by registration date (when "All Marketplaces" is selected)
- OR choose a specific marketplace to get all volunteers for that event

### UI Addition

Insert a styled "or" separator between the date fields and the marketplace selector (after line 2721, before line 2723):

```text
[Start Date picker]
[End Date picker]
  ── or ──
[Marketplace dropdown]
```

The divider will use a horizontal line with "or" centered, similar to common "or" separators (a flex row with two lines and "or" text in the middle).

### Also update the dialog description

Change the subtitle from:
> "Select a date range and format to export volunteer data"

To:
> "Use a date range or select a marketplace to export volunteer data"

This makes the either/or behavior clear from the start.

### One file, ~6 lines added

