

# Fix: Test Email Missing Password Token and CTA Button URL

## Root Cause

Two bugs in **`supabase/functions/send-test-email/index.ts`**:

### 1. `{{password}}` token not resolved
The `{{password}}` token was added to `send-campaign-email` but **not** to `send-test-email`. The `generateCustomTemplateHTML` function's token map (line 639-653) has no `{{password}}` entry, so it renders literally as `{{password}}` in test emails.

Additionally, the `VolunteerData` interface and the volunteer lookup in `EmailManagement.tsx` don't include `temp_password`, so even after adding the token, the data wouldn't be available.

### 2. CTA buttons in body_sections have `href="#"`
When a template has CTA-type body sections (inline CTA buttons), the `CustomTemplateData` interface defines `body_sections` as `Array<{ type: string; content: string }>` — missing the `url` field. The rendering code (line 673) hardcodes `href="#"` instead of using `section.url`. So CTA buttons appear but link nowhere.

## Changes

### File 1: `supabase/functions/send-test-email/index.ts`
1. Add `password?: string` to `VolunteerData` interface
2. Add `url?: string` to the `body_sections` items in `CustomTemplateData` interface
3. Add `'{{password}}'` to the token map in `generateCustomTemplateHTML`, resolving to `volunteerData?.password || 'TestPass123'`
4. Fix CTA body section rendering to use `section.url` instead of `"#"`

### File 2: `src/components/admin/EmailManagement.tsx`
1. Include `temp_password` in the volunteer data lookup (it's already fetched via `select('*')`, just not passed)
2. Add `password: volunteer?.temp_password || ''` to the `volData` object sent to the edge function

## Summary
Two small fixes: add `{{password}}` to the test email's token map + pass `temp_password` from the UI, and fix the CTA `href` from `"#"` to the actual URL from body section data.

