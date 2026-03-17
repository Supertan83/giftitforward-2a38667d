

# Add `{{password}}` Dynamic Token to Email Templates

## Problem
When sending training reminder emails, admins want to include the volunteer's username (email) and password so they don't have to search for their original welcome email. Currently there is no `{{password}}` token available.

## Root Cause
1. The `DYNAMIC_TOKENS` array in `EmailTemplateCenter.tsx` doesn't include a password token
2. The `replaceTokens` function in `send-campaign-email/index.ts` doesn't resolve a password token
3. The volunteer data query in `send-campaign-email/index.ts` (line 312) doesn't fetch `temp_password` from `pending_volunteers`

## Changes

### 1. `src/components/admin/EmailTemplateCenter.tsx`
Add `{{password}}` to the `DYNAMIC_TOKENS` array (after `{{email}}`):
```typescript
{ token: '{{password}}', label: 'Password' },
```

### 2. `supabase/functions/send-campaign-email/index.ts`
- Add `temp_password` to the `Volunteer` interface
- Add `temp_password` to the `.select()` query (line 312)
- Add `'{{password}}': volunteer?.temp_password || ''` to the `replaceTokens` function's tokens map

### 3. `supabase/functions/run-email-automations/index.ts`
Check if the automation email flow also uses `replaceTokens` — if so, apply the same fix there to ensure consistency.

## Security Note
The `temp_password` is already stored in `pending_volunteers` and displayed in the admin UI (PendingVolunteers, WebhookActionsPanel). This token simply makes it available in campaign emails sent by admins. The edge function runs with service role privileges so it can access the data.

