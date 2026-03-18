

# Fix: Manual campaign recipients show empty tokens (name, email, password)

## Problem
When creating a campaign with "Manual Email List" recipients, the system sets `volunteer_id: null` for all recipients (line 202 in EmailCampaignManager.tsx). The `send-campaign-email` edge function then has no volunteer data to resolve tokens like `{{full_name}}`, `{{email}}`, `{{password}}`, resulting in empty values in the received email.

## Root Cause
In `EmailCampaignManager.tsx` lines 197-203, the manual recipient path does:
```typescript
recipientsList = emails.map(email => ({
  email,
  name: email.split('@')[0],
  volunteer_id: null,  // ← no volunteer linked
}));
```

Since `volunteer_id` is null, the edge function skips volunteer data lookup entirely (line 367: `volunteersMap[recipient.volunteer_id] || null` → null), so all tokens resolve to empty strings.

## Solution
**Auto-match manual emails to existing volunteers** by looking up each entered email in the `pending_volunteers` table before creating recipients.

### Changes

#### `src/components/admin/EmailCampaignManager.tsx` (lines 197-203)
Replace the manual recipient resolution block to query `pending_volunteers` by email and link `volunteer_id` when a match is found:

```typescript
} else if (formRecipientType === 'manual') {
  const emails = formManualEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  
  // Look up volunteers by email to auto-link volunteer_id
  const { data: matchedVolunteers } = await supabase
    .from('pending_volunteers')
    .select('id, first_name, last_name, email')
    .in('email', emails);
  
  const volMap = new Map((matchedVolunteers || []).map(v => [v.email.toLowerCase(), v]));
  
  recipientsList = emails.map(email => {
    const vol = volMap.get(email.toLowerCase());
    return {
      email,
      name: vol ? `${vol.first_name} ${vol.last_name}` : email.split('@')[0],
      volunteer_id: vol?.id || null,
    };
  });
}
```

This is the only change needed. The edge function already handles volunteer data lookup correctly when `volunteer_id` is present — it fetches `first_name`, `last_name`, `email`, `temp_password`, etc. from `pending_volunteers` and resolves all tokens. No edge function changes required.

