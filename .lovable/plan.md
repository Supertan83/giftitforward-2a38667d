

## Plan: Add/update April 25–26 marketplace events

Two events are partially in the database (Morning only, with old generic names). I'll align them with the official names from the screenshots and add the missing Afternoon counterparts.

### Changes

**1. Update existing Morning events (rename to official titles)**

| ID | New name | Date | Times |
|---|---|---|---|
| `cedfb6a2-…` | Inclusive Community: Family and People of Determination Marketplace - Morning Event | 2026-04-25 | 09:30 – 14:30 |
| `a2d85409-…` | She Thrives: Women Workers Marketplace - Morning Event | 2026-04-26 | 09:30 – 14:30 |

Also fix locations to match photos:
- April 25 → `Dubai, Al Qusais 1` (already correct)
- April 26 → `Dubai, Al Quoz` (already correct)

**2. Insert two new Afternoon events**

| Name | Date | Location | Times |
|---|---|---|---|
| Inclusive Community: Family and People of Determination Marketplace - Afternoon Event | 2026-04-25 | Dubai, Al Qusais 1 | 14:30 – 20:00 |
| She Thrives: Women Workers Marketplace - Afternoon Event | 2026-04-26 | Dubai, Al Quoz | 14:30 – 20:00 |

Both inserted with:
- `status = 'upcoming'`
- `beneficiary_credit_limit = 15` (default, matches existing Morning rows)
- `max_items_per_scan = 1`
- `outreach_partner = NULL` (consistent with the Morning rows; can be set later)

### How

Single migration with two `UPDATE` statements + two `INSERT` statements into `marketplace_events`. No code changes, no impact on existing data, distributions, or QR cards.

### Notes

- Event naming follows the project convention of using ` - ` as the separator (the photos use an en-dash `–`; we normalize to ` - ` to match every other marketplace in the system, e.g. "Taxi Drivers Marketplace - Morning Event").
- Afternoon end time set to 20:00 per the photos (08.00 pm), even though existing Morning rows have an unusual `end_time = 02:00:00` — those Morning rows will be corrected to 14:30 to match the photos (09.30 am – 02.30 pm).
- Surpluss `external_id` left null on the new Afternoon rows; can be linked later via the existing "Fetch Surpluss Marketplaces" flow.

