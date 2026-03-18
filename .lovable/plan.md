

# On-Site Volunteer Registration System

## Overview

Create a public registration page at `/register` where non-corporate volunteers can self-register during marketplace events. Upon submission, the system automatically creates a volunteer account, generates a QR card, sends a welcome email, and adds them to GIF Admin (Volunteers Added). This mirrors the existing CDA Survey flow but is purpose-built for registration rather than post-event surveys.

## Architecture

The system reuses existing patterns: a public React page (like `ExternalSurveyPage`), a new edge function (`register-onsite-volunteer`), and the existing `bulk-create-volunteers` email/account creation logic.

## Changes

### 1. New Edge Function: `supabase/functions/register-onsite-volunteer/index.ts`

Handles the registration backend. On POST:

- Validates inputs (first_name, last_name, email, marketplace_id, gender, company_name)
- **Duplicate check**: Queries `pending_volunteers` by email. If exists, returns error: "Email already registered. Please check your QR code or reach out to a Team Lead onsite for assistance."
- Creates auth user via `supabase.auth.admin.createUser` (same pattern as `bulk-create-volunteers`)
- Creates `pending_volunteers` record with `source: 'onsite_registration'`, `status: 'approved'`, `external_company` set to the selected org, `is_employee: false`, and `events_list` set to marketplace name
- Creates `volunteer_qr_cards` record with `status: 'inactive'`
- Sends welcome email with QR code (reuse the email HTML builder from `bulk-create-volunteers`)
- Returns `{ success: true, qr_code_id, volunteer_name }`

Config: `verify_jwt = false` in `supabase/config.toml`

### 2. New Page: `src/pages/OnsiteRegistrationPage.tsx`

Public form at `/register` with the following fields:

- **First Name** (required text)
- **Last Name** (required text)
- **Email** (required email, validated)
- **Marketplace Event** (required dropdown — fetched from `marketplace_events` where status = 'active' or 'upcoming')
- **Gender** (dropdown: Male / Female)
- **Organization / Company Name** (dropdown: Nabdh El Emarat, ACKAF, Volunteers.ae, CDA, Venue Volunteers, Other — with free text for "Other")

On submit:
- Calls `register-onsite-volunteer` edge function
- On success: shows confirmation screen with volunteer name, QR code image (via `api.qrserver.com`), and message "Registration complete! Your QR code has been emailed to you."
- On duplicate error: shows the specific duplicate message
- Styled consistently with `ExternalSurveyPage` (dark theme, GIF branding)

### 3. Route Addition: `src/App.tsx`

Add `<Route path="/register" element={<OnsiteRegistrationPage />} />` before the catch-all.

### 4. Admin Export (Already Functional)

No changes needed — registered volunteers appear in `pending_volunteers` with `source: 'onsite_registration'` and are included in the existing Volunteers Added export. The `events_list` field ties them to the marketplace for event-filtered views.

## Key Design Decisions

- **Reuses `bulk-create-volunteers` email pattern** — same branded welcome email with QR code, login credentials, and training link
- **Duplicate detection by `pending_volunteers.email`** rather than auth user lookup — faster and avoids listing all auth users
- **Company as dropdown with fixed options** + "Other" free text — matches the requirement exactly
- **No authentication required** — public page, edge function has `verify_jwt = false`
- **`source: 'onsite_registration'`** — distinguishes these volunteers in admin views and exports

