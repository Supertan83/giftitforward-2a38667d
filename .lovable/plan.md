

## Time-Aware Marketplace Auto-Detection for Kiosk Accounts

### Problem
On days with two marketplace events (e.g., morning 07:00-13:30 and evening 19:30-23:30), the current logic matches both by date and picks the first one. The kiosk should automatically select the correct event based on the current time.

### Solution
Update the auto-detection filter in `src/components/VolunteerInterface.tsx` to also consider `start_time` and `end_time` when multiple events share the same date.

### Logic

1. Filter events by today's date (existing)
2. If only one event matches today, auto-select it (no change)
3. If multiple events match today:
   - Get the current time (HH:MM in local timezone)
   - Find the event whose time window contains "now" (i.e., `start_time <= now <= end_time`)
   - Add a 1-hour buffer before `start_time` so the kiosk is ready for setup
   - If a match is found, auto-select it and hide the dropdown
   - If no match (e.g., between sessions), show the dropdown so staff can pick manually
4. If an event has no `start_time`/`end_time`, treat it as an all-day event (always matches)

### File Changed
`src/components/VolunteerInterface.tsx` -- update the `todaysEvents` filtering logic (around lines 56-58):

```text
// Current:
const todaysEvents = isKioskAccount
  ? availableMarketplaces.filter(m => m.event_date === today)
  : [];
const kioskAutoDetected = todaysEvents.length === 1;

// New:
const todaysEvents = isKioskAccount
  ? availableMarketplaces.filter(m => m.event_date === today)
  : [];

// Time-aware narrowing when multiple events on same day
const now = new Date();
const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;

const timeMatchedEvents = todaysEvents.length > 1
  ? todaysEvents.filter(m => {
      if (!m.start_time || !m.end_time) return true; // no times = all-day
      // 1-hour early buffer for setup
      const [h, min] = m.start_time.split(':').map(Number);
      const bufferTime = `${String(Math.max(0, h-1)).padStart(2,'0')}:${min}:00`;
      return currentTime >= bufferTime && currentTime <= m.end_time;
    })
  : todaysEvents;

const kioskAutoDetected = timeMatchedEvents.length === 1;
```

The `useEffect` and header UI will reference `timeMatchedEvents` instead of `todaysEvents` for auto-selection, while the dropdown fallback still shows all of today's events for manual override.

### No database changes needed
The `start_time` and `end_time` columns already exist and are populated for the 2026 schedule.
