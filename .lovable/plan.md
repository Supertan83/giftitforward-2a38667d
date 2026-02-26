

## Auto-Detect Today's Marketplace for Kiosk Accounts

### What Changes

When a kiosk account logs in, instead of showing a dropdown and waiting for manual selection, the app will automatically find today's marketplace event and select it. If no event matches today, the dropdown remains as a fallback.

### How It Works

In `src/components/VolunteerInterface.tsx`, the existing `useEffect` for kiosk accounts will be extended:

1. Filter `availableMarketplaces` to find one whose `event_date` matches today's date (YYYY-MM-DD)
2. If exactly one match is found, auto-select it (no dropdown needed)
3. If multiple matches exist (e.g., split morning/afternoon sessions), auto-select the first one but keep the dropdown visible so the volunteer can switch
4. If no match, show the dropdown as-is (current behavior)

### Technical Details

**File: `src/components/VolunteerInterface.tsx`**

Update the kiosk `useEffect` block (around line 56):

```text
useEffect(() => {
  if (isKioskAccount) {
    setActiveZone('marketplace');

    // Auto-detect today's marketplace
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todaysEvents = availableMarketplaces.filter(m => m.event_date === today);
    if (todaysEvents.length > 0 && !selectedMarketplaceId) {
      setSelectedMarketplaceId(todaysEvents[0].id);
    }
    return;
  }
  // ... rest unchanged
}, [isKioskAccount, availableMarketplaces, selectedMarketplaceId, ...]);
```

Update the kiosk header section to hide the marketplace selector when exactly one event matches today, and show it otherwise (with a label like "Today's Event: [name]" when auto-detected).

This is a code-only change to one file -- no database changes needed.
