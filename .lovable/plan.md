

## Fix Company Name in Survey Data

### Problem
1. **Internal surveys** (line 131 of `get-survey-reviews/index.ts`): Company is hardcoded as `"Dubai Holding"` for all internal volunteers. In reality, internal volunteers have `is_employee` and `external_company` fields in `pending_volunteers` — non-employees have a company in `external_company`, employees belong to "Dubai Holding".
2. **External surveys** (`submit-external-survey/index.ts`): The `company_name` field from the request body is never saved to the `external_survey_responses` table, so it's always empty.

### Changes

**1. `supabase/functions/get-survey-reviews/index.ts`**
- For internal surveys: look up the volunteer's company from `pending_volunteers` via `volunteer_card_id → volunteer_qr_cards.volunteer_id → pending_volunteers`
- Batch-fetch `pending_volunteers` records for all volunteer IDs found on cards, reading `is_employee` and `external_company`
- Set company to `external_company` if present, else `"Dubai Holding"` if `is_employee` is true, else `""` (unknown)

**2. `supabase/functions/submit-external-survey/index.ts`**
- Save `body.company_name` into the insert payload so external survey responses store the company name

### Data Flow
```text
Internal survey company resolution:
  volunteer_surveys.volunteer_card_id
    → volunteer_qr_cards.volunteer_id
      → pending_volunteers.external_company / is_employee
        → company = external_company || (is_employee ? "Dubai Holding" : "")

External survey fix:
  POST body.company_name → insertData.company_name → external_survey_responses.company_name
```

