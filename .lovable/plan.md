
## Fix: Welcome Emails Showing Wrong Event Dates

### Problem Analysis
Customer Maria Lazarchik registered for events on **February 23** and **March 7**, but received an email with wrong dates. This affects multiple volunteers.

**Root Cause Identified:**
The `getMarketplacesBySlug` function in `webhook-receiver/index.ts` uses fuzzy keyword matching to find marketplace events from the database. The problem is:

1. It matches slugs like `stronger-together-emirati-family-community-marketplace---february-23` by extracting keywords ("stronger", "together", "emirati", "family")
2. It orders results by `event_date ASC` (earliest first)
3. The first matching event wins - so "Stronger Together - February 22" matches before "February 23"
4. Similarly, "She Thrives - February 28" matches before "She Thrives - March 7"

**Evidence from Database:**
- Maria's form data correctly shows: `eventDate: "February 23, 2026"` and `eventDate: "March 7, 2026"`
- But the slug matching found wrong events due to fuzzy matching

---

### Solution Strategy

**Primary Fix:** Improve the slug matching to also match by date extracted from the slug or form data.

The slug contains the date information:
- `stronger-together-emirati-family-community-marketplace---february-23` contains "february-23"
- `she-thrives-women-workers-marketplace---march-7--second-half` contains "march-7"

We need to:
1. Extract the date portion from the slug (e.g., "february-23", "march-7")
2. Also consider the `eventDate` from form data as a matching criterion
3. Match both **name keywords** AND **date** to ensure correct event selection

---

### Technical Implementation

#### Step 1: Update `getMarketplacesBySlug` function

**File:** `supabase/functions/webhook-receiver/index.ts` (lines 363-400)

Current matching logic only checks name keywords. The fix will:
1. Extract month and day from the slug (e.g., "february-23" -> month: 2, day: 23)
2. Compare against the marketplace's `event_date`
3. Require both name match AND date match for a successful lookup

```typescript
async function getMarketplacesBySlug(
  supabase: any, 
  eventSlugs: string[],
  eventsData?: RegisteredEvent[] // Add form data for fallback date matching
): Promise<Map<string, MarketplaceEventDetails>> {
  // ... existing code ...
  
  // Extract date from slug (e.g., "february-23" -> { month: 2, day: 23 })
  function extractDateFromSlug(slug: string): { month: number; day: number } | null {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                    'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (let i = 0; i < months.length; i++) {
      const monthMatch = slug.match(new RegExp(`${months[i]}[\\-]?(\\d{1,2})`));
      if (monthMatch) {
        return { month: i + 1, day: parseInt(monthMatch[1]) };
      }
    }
    return null;
  }
  
  for (const slug of eventSlugs) {
    const slugDate = extractDateFromSlug(slug);
    
    for (const mp of marketplaces) {
      // Check name keywords match (existing logic)
      const matchCount = slugParts.filter(part => mpNameLower.includes(part)).length;
      const nameMatches = matchCount >= 2 || (slugParts.length === 1 && mpNameLower.includes(slugParts[0]));
      
      // Also check date match if we extracted a date from slug
      let dateMatches = true;
      if (slugDate && mp.event_date) {
        const dbDate = new Date(mp.event_date);
        dateMatches = (dbDate.getMonth() + 1) === slugDate.month && 
                      dbDate.getDate() === slugDate.day;
      }
      
      if (nameMatches && dateMatches) {
        result.set(slug, { ...mp, slug });
        break;
      }
    }
  }
}
```

#### Step 2: Fallback to Form Data When DB Match Fails

Since the form data (`eventDate`, `eventLocation`, `eventTime`) is already correct from the registration form, we should trust it when DB matching fails or is uncertain.

**File:** `supabase/functions/webhook-receiver/index.ts` (lines 755-790)

Update the event building logic to prefer form data for dates when there's a mismatch possibility:

```typescript
for (const evt of eventsJson as RegisteredEvent[]) {
  const dbMarketplace = marketplaceDetails.get(evt.event);
  
  // ALWAYS use form data for event details - it's the source of truth
  // Only use DB for normalized formatting and additional metadata
  const eventDateFormatted = evt.eventDate || 
    (dbMarketplace?.event_date ? formatDate(dbMarketplace.event_date) : '');
  
  // For location: prefer form data, fallback to DB
  const eventLocation = evt.eventLocation || dbMarketplace?.location || '';
  
  // For time: prefer form data, fallback to DB formatted times
  const timeRange = evt.eventTime || 
    (startTimeFormatted && endTimeFormatted 
      ? `${startTimeFormatted} - ${endTimeFormatted}` 
      : '');
}
```

---

### Files to Modify

1. **`supabase/functions/webhook-receiver/index.ts`**
   - Lines 363-400: `getMarketplacesBySlug` - Add date extraction and matching
   - Lines 755-790: Event building logic - Prioritize form data

### Expected Outcome

After this fix:
- Volunteers who register for "February 23" will see "February 23" in their email
- Volunteers who register for "March 7" will see "March 7" in their email
- The slug's embedded date will be used to ensure correct matching
- Form data will be trusted as the source of truth when available

### Deployment

The `webhook-receiver` edge function will be redeployed after changes.
