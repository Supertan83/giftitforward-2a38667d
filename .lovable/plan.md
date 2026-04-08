

## Update All Emails to Use Tahoma Font

### What's changing
Replace `Arial, sans-serif` with `Tahoma, Arial, sans-serif` as the primary font-family across all email templates and admin UI email previews. Tahoma is a web-safe font available on virtually all email clients, so no font file embedding is needed.

### Files to update (10 Edge Functions + 3 UI files)

**Edge Functions:**
1. `supabase/functions/send-welcome-email/index.ts`
2. `supabase/functions/send-survey/index.ts`
3. `supabase/functions/send-certificate/index.ts`
4. `supabase/functions/send-campaign-email/index.ts`
5. `supabase/functions/send-test-email/index.ts`
6. `supabase/functions/resend-welcome-email/index.ts`
7. `supabase/functions/bulk-create-volunteers/index.ts`
8. `supabase/functions/register-onsite-volunteer/index.ts`
9. `supabase/functions/webhook-receiver/index.ts`
10. `supabase/functions/send-retake-training/index.ts`

**Admin UI previews:**
1. `src/components/admin/EmailManagement.tsx`
2. `src/components/admin/EmailTemplateCenter.tsx`
3. `src/components/admin/EmailPreviewDialog.tsx`

### Change
In each file, replace all occurrences of:
- `font-family: Arial, sans-serif` → `font-family: Tahoma, Arial, sans-serif`
- `font-family: Georgia, 'Times New Roman', serif` (heading fonts in some templates) → `font-family: Tahoma, Arial, sans-serif`

This ensures consistent Tahoma font across all email content — body text, headings, and UI previews. The uploaded `.ttf` file is not needed since Tahoma is universally available as a system font in email clients.

### Deployment
All updated edge functions will be deployed after changes.

