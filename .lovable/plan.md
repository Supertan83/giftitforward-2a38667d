

## Update Volunteer Sync to Use Full Surpluss API Fields

### What's Changing
The Surpluss Volunteers API now accepts additional fields that we already have in our database but aren't sending. This update will enrich the volunteer data sent to Surpluss and leverage the new bulk-update endpoint for previously synced volunteers.

### Current vs. New Payload

Currently we send only 3-4 fields per volunteer:
- `name`, `email`, `phone`, `source`

After the update, we'll send all available fields:
- `name`, `email`, `phone`, `gender` (MALE/FEMALE), `employed` (YES/NO), `company_name`, `events_registered` (semicolon-separated event titles)

### Changes

**1. Update `sync-surpluss-volunteer-beneficiary` edge function**

- **Enrich the CREATE payload** (for new volunteers) with:
  - `gender`: Map from `pending_volunteers.gender` to uppercase `MALE` / `FEMALE`
  - `employed`: Map from `pending_volunteers.is_employee` to `YES` / `NO`
  - `company_name`: Use `pending_volunteers.external_company` or `pending_volunteers.employee_vertical`
  - `events_registered`: Build from `pending_volunteers.events_list` -- convert comma-separated event slugs to semicolon-separated human-readable event titles by matching against local `marketplace_events` names
  - Remove `source: 'API'` (not in API spec; API sets `source: 'MANUAL'` automatically)

- **Add bulk-update step** for already-synced volunteers: After creating new volunteers, collect all previously-synced volunteers and call `POST /volunteers/bulk-update` to push any updated fields (gender, company, events) that may have been added since the initial sync.

- **Also fetch `events_list` column** from the `pending_volunteers` query (currently not selected)

**2. Event title resolution**

The `events_list` field in our DB contains slugs like `"event-7---cda,event-9---stronger-together"`. We need to resolve these to human-readable marketplace event names for the `events_registered` field. The function will:
- Fetch all local `marketplace_events` with their names
- For each volunteer's `events_list`, match slugs to marketplace names
- Join matched names with semicolons

### Technical Details

Key mapping logic:
```text
pending_volunteers.gender "male" -> "MALE"
pending_volunteers.gender "female" -> "FEMALE"
pending_volunteers.is_employee true -> employed: "YES"
pending_volunteers.is_employee false -> employed: "NO"
pending_volunteers.external_company -> company_name
pending_volunteers.events_list "event-7---cda,event-9---st" -> events_registered: "CDA Marketplace;Stronger Together Marketplace"
```

Bulk-update call (for already-synced volunteers):
```text
POST /volunteers/bulk-update
{
  "volunteers": [
    { "email": "john@example.com", "gender": "MALE", "employed": "YES", "company_name": "Dubai Holding", "events_registered": "CDA;Beach Cleanup" },
    ...
  ]
}
```

No UI changes are needed -- the same sync buttons will now send richer data automatically.

