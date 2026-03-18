
Root cause summary

The problem is coming from the custom-template test path, not the main template editor itself.

1. `send-campaign-email` already supports `{{full_name}}`, `{{email}}`, `{{password}}`, `{{qr_card_id}}`, `{{login_url}}`, `{{training_url}}`, and CTA URL replacement.
2. `send-test-email` uses a different token resolver, and that resolver is inconsistent:
   - `{{email}}` is wrongly replaced with a fake `first_name@example.com` value instead of the real volunteer/test value.
   - `{{username}}` and `{{id}}` are not supported at all.
   - when the entered recipient email is not found in `pending_volunteers`, the fallback test data does not include email, password, or QR ID, so tokens appear blank or wrong.
3. CTA buttons are allowed to render with `href="#"` when the URL is empty or unresolved, and the editor currently does not block that.

What I will implement

1. Unify token behavior across test emails and campaign emails
   - Make test emails use the same token rules as campaign emails.
   - Support these tokens consistently:
     - `{{first_name}}`
     - `{{last_name}}`
     - `{{full_name}}`
     - `{{email}}`
     - `{{password}}`
     - `{{qr_card_id}}`
     - `{{login_url}}`
     - `{{training_url}}`
     - marketplace tokens
   - Add backward-compatible aliases so existing reminder templates also work:
     - `{{username}}` → volunteer email
     - `{{id}}` → volunteer QR card ID

2. Fix test-email personalization data
   - Pass the real volunteer email into the test renderer instead of generating a fake placeholder.
   - Ensure fallback/simulated test data also includes email, password, and QR ID so tokens still resolve during testing.
   - Keep subject, greeting, body sections, and CTA button all using the same resolver.

3. Fix CTA button behavior
   - Resolve tokenized URLs before rendering the button.
   - Prevent sending a broken CTA when button text exists but URL is missing/invalid.
   - Normalize known app links like training/login so the final button always points to a usable absolute URL.

4. Improve the admin testing flow
   - Make the test-email UI clearer about whether it is using:
     - real volunteer data, or
     - simulated fallback data
   - If the typed email is not found, show a warning before send so admins know token values may be simulated.

Files to update

- `supabase/functions/send-test-email/index.ts`
- `supabase/functions/send-campaign-email/index.ts`
- `src/components/admin/EmailManagement.tsx`
- `src/components/admin/EmailTemplateCenter.tsx`

Technical implementation details

- Extract/align a shared token map pattern inside both email functions so they resolve the same placeholders.
- Replace the broken `{{email}}` logic in test emails with the actual `volunteer_data.email`.
- Extend the test payload built in `EmailManagement.tsx` so `volunteer_data` always includes:
  - `email`
  - `password`
  - `qr_card_id`
  - `name`
- Add CTA validation in the template editor/test flow:
  - if CTA text is filled and URL is empty, block save/send with a clear message
  - if URL resolves to empty, do not render a fake `#` link
- Preserve existing templates by supporting both the newer tokens and the admin-used aliases.

Expected outcome

After this change:
- `{{full_name}}` will show the volunteer’s real full name
- `{{email}}` will show the real email
- `{{password}}` will show the stored temporary password when available
- old templates using `{{username}}` and `{{id}}` will keep working
- the “Start Training” CTA button will open the correct training page instead of behaving like a dead link
- admins will get clearer test results and fewer false negatives when testing templates
