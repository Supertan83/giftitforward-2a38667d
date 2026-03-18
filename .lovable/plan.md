

# Fix: Email tokens empty for real volunteers + CTA not working

## Root cause

In `EmailManagement.tsx` (line 480-491), when the admin enters a recipient email that IS found in the `pending_volunteers` table, the `volData` object sent to the edge function is **missing the `email` field**:

```typescript
const volData = volunteer
  ? {
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      name: `${volunteer.first_name} ${volunteer.last_name}`,
      phone: volunteer.phone_number || '',
      // ❌ MISSING: email field!
      // ...
      password: (volunteer as any)?.temp_password || '',
    }
```

Since `volunteerData.email` is undefined in the edge function, `{{email}}` and `{{username}}` both resolve to empty string. The `{{full_name}}` token works via the `name` field, but `{{email}}` and `{{password}}` fail.

For the CTA button, the issue is that when admins use `{{training_url}}` as the button URL in either a body CTA section or the bottom CTA fields, the token resolves correctly in the edge function. However, if the template was saved with empty `cta_url` or no URL on a body CTA section, the button is suppressed entirely (which looks "broken" to the admin).

## Fix (1 file)

### `src/components/admin/EmailManagement.tsx`
Add the missing `email` field to the `volData` object when a real volunteer is found:

```typescript
const volData = volunteer
  ? {
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      name: `${volunteer.first_name} ${volunteer.last_name}`,
      email: volunteer.email,  // ← ADD THIS
      phone: volunteer.phone_number || '',
      marketplace_name: marketplaceName,
      marketplace_date: marketplaceDate,
      marketplace_location: marketplaceLocation,
      marketplace_time: marketplaceTime,
      qr_card_id: qrCardId,
      password: (volunteer as any)?.temp_password || '',
    }
```

This is a one-line fix. No edge function changes needed since the token resolution logic already handles `{{email}}`, `{{full_name}}`, `{{password}}` correctly — it just wasn't receiving the email value from the frontend.

