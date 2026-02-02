

## Fix Welcome Email - Missing Event Name for Single Event Registrations

### Problem Identified
Volunteers who register for **only one event** receive welcome emails without the event name and red border styling. This is because the `webhook-receiver` edge function uses a different template for single events vs. multiple events:

- **Multiple events**: Shows event name with red left border styling (correct format as in image 1)
- **Single event**: Shows only date/location/timings as a simple bullet list (incorrect format as in image 2)

### Root Cause Location
**File**: `supabase/functions/webhook-receiver/index.ts` (lines 1063-1094)

```typescript
// Current problematic code:
if (registeredEvents.length > 1) {
  // Multiple events - shows name with red border ✓
  eventDetailsHtml = registeredEvents.map((evt) => `
    <div style="...border-left: 3px solid #DA291C;...">
      <p style="...font-weight: bold;">${evt.name}</p>
      ...
    </div>
  `).join('');
} else if (registeredEvents.length === 1) {
  // Single event - NO name, NO red border ✗
  const evt = registeredEvents[0];
  eventDetailsHtml = `
    <ul style="...">
      <li>Date: ${evt.date}</li>
      <li>Location: ${evt.location}</li>
      <li>Timings: ${evt.time}</li>
    </ul>
  `;
}
```

### Solution
Update the single-event branch to use the **same** red-bordered design with event name, matching the multi-event format. This ensures all volunteers see consistent email formatting regardless of how many events they registered for.

---

### Technical Implementation

#### Step 1: Update `webhook-receiver/index.ts`
Modify the single-event template (lines 1075-1084) to include the event name with red left border styling:

```typescript
// Fixed code:
} else if (registeredEvents.length === 1) {
  // Single event - NOW includes name with red border ✓
  const evt = registeredEvents[0];
  eventDetailsHtml = `
    <div style="margin-bottom: 15px; padding: 12px 15px; background-color: #f9fafb; border-left: 3px solid #DA291C; border-radius: 0 4px 4px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">${evt.name}</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.6;">
        ${evt.date ? `<li><strong>Date:</strong> ${evt.date}</li>` : ''}
        ${evt.location ? `<li><strong>Location:</strong> ${evt.location}</li>` : ''}
        ${evt.time ? `<li><strong>Timings:</strong> ${evt.time}</li>` : ''}
      </ul>
    </div>
  `;
}
```

#### Step 2: Also Update `send-welcome-email/index.ts`
The same issue exists in the fallback template in the `send-welcome-email` edge function (lines 150-169). When only a `marketplace` object is provided (without events array), it shows date/location/timings without the event name.

Update the single marketplace fallback to use the `buildEventBlock` function:

```typescript
// Fixed code:
} else if (marketplace) {
  // Single marketplace - use the same red-bordered design
  const eventDate = formatDate(marketplace.event_date);
  const startTime = formatTime(marketplace.start_time);
  const endTime = formatTime(marketplace.end_time);
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
  
  eventsHtml = buildEventBlock({
    name: marketplace.name || 'Gift It Forward marketplace',
    date: eventDate,
    time: timeRange,
    location: marketplace.location || '',
  });
}
```

#### Step 3: Redeploy Edge Functions
Both `webhook-receiver` and `send-welcome-email` will need to be redeployed.

---

### Expected Outcome
After this fix:
- Single-event volunteers will see their event name with the red left border styling
- Multi-event volunteers will continue to see all events with the same format
- All welcome emails will have consistent, branded formatting

### Files to Modify
1. `supabase/functions/webhook-receiver/index.ts` - Single event template
2. `supabase/functions/send-welcome-email/index.ts` - Marketplace fallback template

