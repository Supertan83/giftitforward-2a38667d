
## Remove Marketplaces from Volunteer Registrations

### Problem Statement
Volunteers register for events through the DH form, and their event data is stored in `pending_volunteers.events_json`. Some volunteers are requesting changes to their registrations - they want to:
- Remove specific marketplace events they originally registered for
- Change from one marketplace date to another

Currently, admins have no way to edit or remove events from a volunteer's registration data.

---

### Current Data Structure

Volunteer event data is stored in two places:
1. **`pending_volunteers.events_json`** - Array of registered events from webhook
2. **`pending_volunteers.events_list`** - Comma-separated slugs (derived from events_json)

Example `events_json`:
```json
[
  {
    "event": "stronger-together-emirati-family-community-marketplace---february-23",
    "eventDate": "February 23, 2026",
    "eventLocation": "Dubai, Al Twar",
    "eventTime": "7:30PM – 11:30PM",
    "family-members-joining": "No"
  },
  {
    "event": "she-thrives-women-workers-marketplace---march-7",
    "eventDate": "March 7, 2026",
    "eventLocation": "Dubai, Al Quoz", 
    "eventTime": "7:30AM – 4:30PM"
  }
]
```

---

### Solution: Add Event Removal UI

#### Location: User Management Edit Dialog
The "Edit User" dialog already displays registered events (read-only). We will make these events removable with an "X" button next to each event.

#### UI Changes

```text
+------------------------------------------+
| Edit User                                |
|------------------------------------------|
| ...existing fields...                    |
|------------------------------------------|
| Registered Events (from webhook)      [2]|
| +--------------------------------------+ |
| | [ ] Stronger Together: Feb 23        [x]
| |     📅 Feb 23  🕐 7:30PM  📍 Al Twar  |
| +--------------------------------------+ |
| | [ ] She Thrives: Mar 7               [x]
| |     📅 Mar 7  🕐 7:30AM  📍 Al Quoz   |
| +--------------------------------------+ |
|                                          |
| [Delete checked events] (appears when    |
| one or more events are checked)          |
+------------------------------------------+
```

---

### Technical Implementation

#### Step 1: Add State for Event Removal
**File:** `src/components/admin/UserManagement.tsx`

Add new state variables:
```typescript
const [editEventsJson, setEditEventsJson] = useState<any[]>([]);
const [eventsToRemove, setEventsToRemove] = useState<Set<number>>(new Set());
```

Initialize in `handleEditUser`:
```typescript
if (user.events_json && Array.isArray(user.events_json)) {
  setEditEventsJson([...user.events_json]);
}
setEventsToRemove(new Set());
```

#### Step 2: Make Events Editable in UI
Replace the read-only events display with a checklist that allows selection for removal:

```typescript
{editEventsJson.map((ev, idx) => (
  <div key={idx} className="...">
    <Checkbox
      checked={eventsToRemove.has(idx)}
      onCheckedChange={(checked) => {
        const newSet = new Set(eventsToRemove);
        if (checked) newSet.add(idx);
        else newSet.delete(idx);
        setEventsToRemove(newSet);
      }}
    />
    <div className="flex-1">
      <span>{ev.event_name || ev.event}</span>
      <div>{ev.eventDate} | {ev.eventTime} | {ev.eventLocation}</div>
    </div>
    <Button variant="ghost" size="icon" onClick={() => {/* toggle removal */}}>
      <X />
    </Button>
  </div>
))}
```

#### Step 3: Create Update Mutation
**File:** `src/hooks/useSupabaseData.ts`

Add a new mutation `useUpdateVolunteerEvents`:
```typescript
export const useUpdateVolunteerEvents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      pendingVolunteerId, 
      eventsJson,
      eventsList 
    }: { 
      pendingVolunteerId: string; 
      eventsJson: any[];
      eventsList: string;
    }) => {
      const { error } = await supabase
        .from('pending_volunteers')
        .update({ 
          events_json: eventsJson,
          events_list: eventsList
        })
        .eq('id', pendingVolunteerId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
    }
  });
};
```

#### Step 4: Handle Event Removal on Save
In `handleUpdateRole`, after updating role and assignments, also update events if any were removed:

```typescript
// If events were removed, update the pending_volunteers record
if (eventsToRemove.size > 0 && editUser?.pending_volunteer_id) {
  const remainingEvents = editEventsJson.filter((_, idx) => !eventsToRemove.has(idx));
  const newEventsList = remainingEvents.map(ev => ev.event).join(',');
  
  await updateVolunteerEvents.mutateAsync({
    pendingVolunteerId: editUser.pending_volunteer_id,
    eventsJson: remainingEvents,
    eventsList: newEventsList
  });
}
```

#### Step 5: Also Update volunteer_qr_cards
When events are removed, we should also clean up the corresponding QR card assignments:

```typescript
// Find marketplace IDs that correspond to removed events
const removedEventSlugs = editEventsJson
  .filter((_, idx) => eventsToRemove.has(idx))
  .map(ev => ev.event);

// Match to marketplace IDs and remove those assignments
for (const slug of removedEventSlugs) {
  const matched = marketplaces.find(m => /* fuzzy match slug to marketplace */);
  if (matched) {
    // Remove this marketplace from user's QR cards
    await supabase
      .from('volunteer_qr_cards')
      .update({ marketplace_id: null })
      .eq('volunteer_id', editUser.pending_volunteer_id)
      .eq('marketplace_id', matched.id);
  }
}
```

---

### Files to Modify

1. **`src/components/admin/UserManagement.tsx`**
   - Add state for tracking events to remove
   - Update events display UI to allow selection/removal
   - Update `handleUpdateRole` to persist event changes

2. **`src/hooks/useSupabaseData.ts`**
   - Add `useUpdateVolunteerEvents` mutation

---

### User Experience Flow

1. Admin searches for volunteer by name/email
2. Clicks "Edit" button to open edit dialog
3. Sees list of registered events with checkboxes
4. Checks events they want to remove
5. Clicks "Remove Selected Events" button (or individual X buttons)
6. Events are immediately removed from the list (visual feedback)
7. On "Save Changes", the updated events are persisted to database
8. Related QR card assignments are also cleaned up

---

### Edge Cases Handled

- **Single event removal**: Volunteer has one event left after removal
- **All events removed**: Show warning that volunteer will have no events
- **Already has QR cards**: Cleanup marketplace assignments when events removed
- **Confirm before save**: Changes only persist when "Save Changes" is clicked

---

### Alternative: Also Add to PendingVolunteers.tsx

The same functionality could be added to the "Volunteers Added" section (`PendingVolunteers.tsx`) which already has inline editing capabilities. This would allow editing events from that view as well.

