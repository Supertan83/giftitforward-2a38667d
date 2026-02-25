

# Restore Family Member Data for Ahlam and Yogesh

## Current State

| Volunteer | Dependents in events_json | Cards | Missing |
|-----------|--------------------------|-------|---------|
| Ahlam AlHashemi | 0 | Primary only | 3 family members need cards + data |
| Yogesh Arora | 1 (Romika Arora) | Primary + F1 + F2 | Muskan Arora name not in events_json |

## Changes Required

### 1. Update events_json for both volunteers

**Ahlam** (id: `71579f66-931f-4dc3-8f90-47a1b4a30ed6`):
Add 3 dependents to her most recent attended event entry so the system recognizes them:
- Muna Yousuf Al Hashemi
- Ghazlan Mohammad Al Suwaidi
- Al Hanoof Mohammad Al Suwaidi

**Yogesh** (id: `0e442ce8-2e89-45d7-883e-869e6d410b55`):
Add Muskan Arora as a 2nd dependent alongside existing Romika Arora in his events_json.

### 2. Create 3 family QR cards for Ahlam

Generate family cards F1, F2, F3 linked to her volunteer ID, since none exist.

### 3. No card creation needed for Yogesh

His F2 card (`VOL-ML0T9E56-YL8R-F299`) already exists -- it just needs the name mapping via events_json update.

## Implementation

Create an edge function `restore-family-members` that:
1. Updates Ahlam's events_json to inject dependents into one of her event entries
2. Creates 3 family QR cards (F1, F2, F3) for Ahlam
3. Updates Yogesh's events_json to add Muskan Arora as a second dependent
4. Returns a summary of all changes made

## Technical Details

- **File**: `supabase/functions/restore-family-members/index.ts`
- One-time-use edge function (consistent with the project's preference for maintenance via edge functions)
- Uses service role key for direct DB writes
- Updates events_json by appending dependents to the last event entry with `family-members-joining` set to `Yes`

## After Running

- Ahlam will have 3 family cards with proper name resolution for certificates
- Yogesh's F2 card will correctly map to "Muskan Arora" for certificates
- Both families' certificates can be generated from the admin panel

