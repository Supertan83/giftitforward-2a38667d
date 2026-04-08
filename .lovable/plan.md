

## Add The Surpluss Logo Between Hero Image and Red Vertical Line in All Emails

### What's changing
Adding The Surpluss logo (centered, with padding) between the hero banner image and the red vertical line separator in every email template and the admin email preview component.

### Steps

**Step 0: Upload logo to email-assets storage bucket**
- Copy the uploaded Surpluss logo (`user-uploads://image-100.png`) to `public/images/email/surpluss-logo.png` for preview
- Upload it to the `email-assets` storage bucket as `surpluss-logo.png` for use in actual emails

**Step 1: Add logo row in all Edge Function email templates**

Insert a new `<tr>` block between the hero image row and the red vertical line row in each file:

```html
<!-- The Surpluss Logo -->
<tr>
  <td style="padding: 20px 0 0 0; text-align: center;">
    <img src="${surplussLogoUrl}" alt="The Surpluss" height="45" style="display: block; margin: 0 auto;" />
  </td>
</tr>
```

Add `surplussLogoUrl` variable alongside existing asset URLs in each function.

**Files to update (Edge Functions — 9 files):**
1. `supabase/functions/send-campaign-email/index.ts`
2. `supabase/functions/send-test-email/index.ts`
3. `supabase/functions/send-certificate/index.ts`
4. `supabase/functions/send-survey/index.ts`
5. `supabase/functions/send-welcome-email/index.ts`
6. `supabase/functions/webhook-receiver/index.ts`
7. `supabase/functions/resend-welcome-email/index.ts`
8. `supabase/functions/bulk-create-volunteers/index.ts`
9. `supabase/functions/register-onsite-volunteer/index.ts`

**Step 2: Update admin UI preview components (2 files):**
1. `src/components/admin/EmailPreviewDialog.tsx` — add logo `<img>` between hero and title
2. `src/components/admin/EmailManagement.tsx` — add logo in preview section
3. `src/components/admin/EmailTemplateCenter.tsx` — add logo in preview section

**Step 3: Deploy updated edge functions**

### Logo placement (visual)

```text
┌──────────────────────────┐
│     Hero Banner Image     │
├──────────────────────────┤
│    [The Surpluss Logo]    │  ← NEW (centered, padding 20px top/bottom)
├──────────────────────────┤
│       Red Vertical Line   │
├──────────────────────────┤
│     Email Content...      │
└──────────────────────────┘
```

