

## Fix: Campaign Emails Not Showing Dynamic Data (QR, Marketplace Info)

### Problem
When sending campaign emails, the template tokens `{{marketplace_name}}`, `{{marketplace_date}}`, `{{marketplace_time}}`, `{{marketplace_location}}`, and `{{qr_card_id}}` all render as empty because:

1. **Line 247**: `generateCampaignEmailHTML()` is called without any `marketplaceData` argument
2. **Line 68**: `{{qr_card_id}}` is hardcoded to `''` -- no QR card lookup is performed
3. The function loads volunteer records but never queries `marketplace_events` or `volunteer_qr_cards`

### Solution
Update `supabase/functions/send-campaign-email/index.ts` to look up each volunteer's marketplace and QR card data before generating the email.

### Changes (single file)

**File: `supabase/functions/send-campaign-email/index.ts`**

**A. After loading volunteer data (~line 237), add marketplace + QR lookups per volunteer:**

For each volunteer with `events_json`, parse the first event's slug, then query `marketplace_events` for event details (name, date, start_time, end_time, location). If the volunteer has multiple events, build a combined display (same pattern as the welcome email).

Query `volunteer_qr_cards` by `volunteer_id` to get the `unique_id` for the QR card token.

**B. Update the `replaceTokens` call (line 68):**

Change `'{{qr_card_id}}'` from hardcoded `''` to accept a value passed in from the lookup.

**C. Update the sending loop (~line 243-247):**

Before generating HTML for each recipient, look up marketplace data from the volunteer's `events_json` and pass it to `generateCampaignEmailHTML`.

### Technical Details

```text
For each recipient with a volunteer_id:

1. Get volunteer from volunteersMap
2. Parse volunteer.events_json (array of event objects)
3. Query marketplace_events for the first event's slug to get:
   - name, event_date, start_time, end_time, location
4. Query volunteer_qr_cards for volunteer's unique_id:
   - SELECT unique_id FROM volunteer_qr_cards WHERE volunteer_id = volunteer.id LIMIT 1
5. Pass marketplaceData and qrCardId to generateCampaignEmailHTML / replaceTokens
```

The `replaceTokens` function signature stays the same but will receive actual marketplace data and QR card ID instead of empty defaults.

No database changes needed.
