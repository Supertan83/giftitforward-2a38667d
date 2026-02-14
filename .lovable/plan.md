
# External Company Volunteer Survey (Shared Link)

## Overview
Create a public, shareable survey link for each marketplace that external company volunteers can open (e.g., from an SMS blast), enter their name and email, complete the same 3 survey questions, and receive their participation certificate.

## How It Works

1. Admin goes to a new "External Survey Links" section in the admin dashboard
2. Admin selects a marketplace and clicks "Generate Survey Link"
3. The system creates a unique shareable URL like: `https://giftitforward.lovable.app/external-survey?marketplace=abc123`
4. Admin copies this link and shares it with the external company for their SMS blast
5. Volunteers open the link, enter their name + email, answer the 3 questions, and get their certificate

## Changes

### 1. New Database Table: `external_survey_responses`
Store survey responses from external volunteers (separate from internal `volunteer_surveys` to avoid mixing data).

Columns:
- `id` (uuid, primary key)
- `marketplace_id` (uuid, references marketplace_events)
- `volunteer_name` (text, required)
- `volunteer_email` (text, required)
- `company_name` (text, optional -- auto-filled from outreach partner if set)
- `experience_word` (text)
- `would_volunteer_again` (boolean)
- `improvement_suggestions` (text)
- `certificate_sent_at` (timestamptz)
- `completed_at` (timestamptz)
- `created_at` (timestamptz, default now())

RLS: Public INSERT (no auth needed since it's a public survey form), staff can SELECT/manage.

### 2. New Edge Function: `submit-external-survey`
Handles both fetching marketplace info (GET) and submitting survey responses (POST).
- GET: Validates marketplace ID, returns marketplace name/date/location for display
- POST: Validates inputs, inserts into `external_survey_responses`, auto-sends attendance certificate via the existing `send-certificate` flow

### 3. New Page: `src/pages/ExternalSurveyPage.tsx`
A public page (no login required) at route `/external-survey?marketplace=<id>`.
- Step 1: Volunteer enters their name and email
- Step 2: Same 3 survey questions (experience word, volunteer again, improvement suggestions)
- Step 3: Submit and receive certificate (download + email, same as current survey page)
- Branded with GIF/Dubai Holding styling, matching the existing survey page look

### 4. New Admin Component: `src/components/admin/ExternalSurveyLinksManager.tsx`
A section in the admin dashboard to:
- Select a marketplace from a dropdown
- Generate and display the shareable survey URL
- One-click copy button (mobile-safe, same pattern as schema export)
- View count of responses received per marketplace

### 5. Route Registration (`src/App.tsx`)
Add `/external-survey` route pointing to `ExternalSurveyPage`.

### 6. Admin Sidebar and Dashboard Updates
- Add "External Survey Links" to the sidebar under Beneficiary Apps or a new section
- Register the new view in AdminDashboard

## Technical Details

### Database Migration SQL
```text
CREATE TABLE public.external_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id uuid NOT NULL,
  volunteer_name text NOT NULL,
  volunteer_email text NOT NULL,
  company_name text,
  experience_word text,
  would_volunteer_again boolean,
  improvement_suggestions text,
  certificate_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_survey_responses ENABLE ROW LEVEL SECURITY;

-- Public can insert (survey is public-facing)
CREATE POLICY "Anyone can submit external survey"
  ON public.external_survey_responses FOR INSERT
  WITH CHECK (true);

-- Staff can view all responses
CREATE POLICY "Staff can view external survey responses"
  ON public.external_survey_responses FOR SELECT
  USING (is_staff(auth.uid()));

-- Admins can manage
CREATE POLICY "Admins can manage external survey responses"
  ON public.external_survey_responses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Edge Function: `submit-external-survey`
- GET with `?marketplace_id=xxx` returns marketplace details (name, date, location)
- POST accepts name, email, survey answers; inserts record; generates and emails certificate
- Uses existing `generateCertificatePDF` pattern via the `send-certificate` edge function
- No authentication required (public endpoint, JWT verification disabled in config.toml)

### External Survey Page Flow
```text
1. User opens link --> page fetches marketplace info via GET
2. Shows branded form with marketplace name/date
3. User fills name, email, 3 questions
4. Submit --> POST to edge function
5. Certificate generated client-side, emailed via send-certificate, download offered
```

### Admin Link Generator
- Dropdown of all marketplaces
- Generated URL format: `https://giftitforward.lovable.app/external-survey?marketplace={marketplace_id}`
- Copy button with mobile-safe clipboard fallback
- Response count badge per marketplace (query from external_survey_responses)
