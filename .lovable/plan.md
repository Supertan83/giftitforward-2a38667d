

# Marketplace Zone: Volunteer Usability Improvements

## Problems Identified

1. **+/- buttons too small** (48x48px) for rapid outdoor use under time pressure
2. **Label "Quantity per scan"** is unclear to volunteers -- client requests "Items Distributed Per Scan"
3. **Error/warning feedback disappears after 1.5 seconds** -- too fast to read and act on
4. **No quick-select shortcuts** -- volunteers must tap +/- repeatedly to reach common quantities like 3, 5, 10

## Changes

### 1. Larger +/- Buttons and Quick-Select Presets

**File:** `src/components/zones/MarketplaceZone.tsx`

- Increase +/- button size from `h-12 w-12` to `h-16 w-16` with larger icons (`w-7 h-7`)
- Add preset quick-select buttons (1, 3, 5, 10) as large tappable chips below the +/- row, so volunteers can jump to common quantities in one tap instead of repeated pressing
- Change label from "Quantity per scan" to dynamic: **"Items to Distribute Per Scan"** or **"Items to Return Per Scan"** depending on the active mode
- Increase the quantity number font size from `text-4xl` to `text-5xl` for better outdoor visibility

### 2. Longer Error/Warning Feedback Duration

**File:** `src/components/FeedbackOverlay.tsx`

- Change the auto-dismiss timeout based on feedback type:
  - **Success**: keep at 1.5s (fast confirmation is fine)
  - **Error**: increase to 3.5s (give volunteers time to read the limit message)
  - **Warning**: increase to 3s (moderate pause for actionable warnings)
- This requires no UI change -- just adjusting the `setTimeout` delay based on `type`

### 3. Summary of UI Changes

| Element | Before | After |
|---------|--------|-------|
| +/- button size | 48x48px | 64x64px |
| +/- icon size | 20px | 28px |
| Quantity label | "Quantity per scan" | "Items to Distribute Per Scan" / "Items to Return Per Scan" |
| Quick presets | None | 1, 3, 5, 10 chips |
| Quantity font | text-4xl | text-5xl |
| Error dismiss | 1.5s | 3.5s |
| Warning dismiss | 1.5s | 3s |
| Success dismiss | 1.5s | 1.5s (unchanged) |

### Technical Details

- Quick-select presets will be filtered to only show values <= `creditLimit`
- Active preset gets highlighted with primary color
- Presets are rendered as a row of rounded pill buttons with `min-h-[44px]` for touch targets
- FeedbackOverlay receives `type` prop already, so timeout logic is a simple conditional

