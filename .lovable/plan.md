## Goal
Add a new **Volunteer Check-in Evidence** section to the Full Report page, with downloadable CSV exports for each sub-view.

## New section: "Volunteer Check-in Evidence"

Inserted as a collapsible/expandable card below the existing marketplace table in `src/components/admin/FullReport.tsx`.

### Data sources
- `volunteer_qr_cards` — `id, unique_id, volunteer_id, marketplace_id, status, checked_in_at, checked_out_at, total_hours_worked` (filter `deleted_at is null`)
- `pending_volunteers` — for volunteer name, email, company, employee/external flag, source (used to detect walk-ins/onsite registrations)
- `marketplace_events` — for event name + date
- `volunteer_attendance` (if present) — fallback for hours/check-in timestamps

### Sub-views (each with its own "Download CSV" button)

1. **Daily / Event-level Attendance Summary**
   - Table: Event name | Date | Registered | Checked-in | Checked-out | No-shows | Walk-ins (onsite source) | Attendance %
   - CSV: same columns

2. **Per-volunteer Check-in Sheet** (the "registration/check-in export")
   - Filter: by marketplace event (dropdown) + search box
   - Columns: Volunteer name | Email | Company | Employee/External | Event | Card unique_id | Status | Check-in time | Check-out time | Hours worked | Source (webhook/onsite/bulk)
   - CSV: same columns; "Download all events" option exports everything

3. **Breakdown by Company**
   - Table: Company | Total volunteers | Checked-in | Hours contributed | Events covered
   - CSV: same columns

4. **Notes column / Manual adjustments**
   - Auto-derived flags shown inline:
     - "No-show" → registered (has QR card or events_list match) but no check-in
     - "Walk-in" → `pending_volunteers.source = 'onsite'`
     - "Manual adjustment" → row exists in `volunteer_qr_cards` but volunteer_id is null OR hours edited (presence in `VolunteerHoursEditDialog` audit if available)
   - Included as a "Notes" column inside sub-view #2; also a top-level summary card showing counts of each.

### UI structure
```text
[existing marketplace table]

── Volunteer Check-in Evidence ──────────────────
  Summary chips: Total registered · Total checked-in · No-shows · Walk-ins · Manual adjustments
  
  Tabs: [Event Summary] [Per-Volunteer Sheet] [By Company]
    each tab → table + "Download CSV" button (top-right)
  
  Master action: "Download all (ZIP)" — one click, bundles all 3 CSVs
```

### Downloadable bundle
Use existing in-browser CSV approach (no new deps). For "Download all", generate 3 CSVs and trigger 3 sequential downloads (simpler than adding JSZip). If you'd prefer a single ZIP, we can add `jszip`.

## Out of scope
- No new DB tables or migrations.
- No changes to volunteer check-in/check-out logic.
- No screenshot capture of the QR scanner UI (system can't access live camera frames retroactively); "QR/check-in screenshots" will be represented by the per-volunteer sheet which is the canonical backend export.

## Open question
For "Download all" — single ZIP (adds `jszip` dependency) or 3 sequential CSV downloads (no new dep)? Default: 3 sequential downloads.
