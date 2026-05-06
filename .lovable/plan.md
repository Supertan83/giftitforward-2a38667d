## Problem

When an admin adds a volunteer to the **Afternoon** shift of a marketplace via *Volunteers Added → Profile → Add Event*, the volunteer also shows up under the **Morning** shift of the same marketplace in the Marketplace Reports / Allocations view.

Root cause is in `src/hooks/useMarketplaceAllocations.ts → eventSlugMatchesMarketplace()`, which is the matcher used to decide which marketplace a volunteer's `events_list` slug belongs to.

```ts
const STOP_TOKENS = new Set([
  'the','and','for','marketplace','event',
  'morning','afternoon','evening',          // ← time-slot tokens stripped
  'day','first','second','third','half','part'
]);
```

The matcher then:
1. Splits the slug into tokens, removes stop words and month names.
2. Says it matches if ≥2 remaining tokens are substrings of the marketplace name.
3. If the marketplace has a date and the slug encodes a date, requires them to match.

For the *Inclusive Community Family And People Of Determination Marketplace*, the **Morning Event** and **Afternoon Event** rows in `marketplace_events` share the same date and almost all words. The only distinguishing tokens are `morning` / `afternoon`, but those are explicitly stripped as stop words. So a slug containing `…-afternoon-event` matches **both** marketplace rows → the volunteer appears under both shifts.

The same root cause explains the previously-noticed *Mens Aviation MP* duplication.

The webhook receiver already handles this conflict during marketplace creation (see memory: "Webhook Marketplace Processing Logic" → `hasConflictingTimeSlot`), but the client-side matcher used for reporting/allocations does not.

## Fix

Update `eventSlugMatchesMarketplace` in `src/hooks/useMarketplaceAllocations.ts` to enforce time-slot agreement when either side uses a time-slot keyword.

### 1. Add a small helper

```ts
const TIME_SLOT_GROUPS: string[][] = [
  ['morning'],
  ['afternoon'],
  ['evening'],
  ['first half', 'first-half', 'firsthalf'],
  ['second half', 'second-half', 'secondhalf'],
  ['day 2', 'day-2', 'day2'],
  ['day 3', 'day-3', 'day3'],
];

function detectTimeSlot(text: string): string | null {
  const t = text.toLowerCase();
  for (const group of TIME_SLOT_GROUPS) {
    if (group.some(k => t.includes(k))) return group[0]; // canonical key
  }
  return null;
}
```

### 2. Use it inside `eventSlugMatchesMarketplace`

After the existing token-overlap check, before returning `true`:

```ts
const slugSlot = detectTimeSlot(slug);
const nameSlot = detectTimeSlot(marketplaceName);

// If either side declares a time slot, both must agree.
// (If only one declares one, treat as mismatch — they are clearly different shifts.)
if (slugSlot || nameSlot) {
  if (slugSlot !== nameSlot) return false;
}
```

This means:
- Slug `…-afternoon-event` will no longer match a marketplace named `… - Morning Event`.
- Slug with no time slot will no longer accidentally match a marketplace that explicitly says "Morning Event" (and vice versa) — which is the safer behaviour for shift-split marketplaces.
- Marketplaces with no shift split (no morning/afternoon/etc. in the name) are unaffected.

### 3. Keep the existing date check

The existing date check stays as a second guard. Together: token overlap **and** date (when present) **and** time-slot agreement.

### Out of scope
- No DB changes, no edits to existing `events_list` / `events_json` data.
- No changes to `webhook-receiver` (already handles this on the write path).
- No changes to `PendingVolunteers.tsx → addEventMutation`; the slug it generates from `eventName.toLowerCase().replace(/\s+/g, '-')` already contains `morning` / `afternoon` when the marketplace name does, so the new matcher will disambiguate correctly.

### Verification
- Add Sarah to *Inclusive Community … Marketplace - Afternoon Event* via Add Event.
- Confirm she appears only in the Afternoon row in Marketplace Reports / allocations, not the Morning row.
- Spot-check Mens Aviation MP (morning vs afternoon) and any "First Half / Second Half" marketplace.
