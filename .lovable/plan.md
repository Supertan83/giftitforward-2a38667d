

# Allow Resending Family Member Certificates

## Problem

When a family member's certificate status shows "Sent", the Action column displays "—" with no option to resend. Admins need the ability to resend certificates (e.g., when the original was never actually delivered due to the false-positive bug).

## Solution

Change the Action column logic in the Send Family Certs dialog so that:
- **Checked out + not sent** -- shows "Send" button (current behavior, unchanged)
- **Checked out + already sent** -- shows "Resend" button (new)
- **Not checked out** -- shows "—" (unchanged)

## File Changed

| File | Change |
|------|--------|
| `src/components/admin/PendingVolunteers.tsx` | Update `canSend` condition (line ~3341) to allow action when `status === 'checked_out'` regardless of `survey_completed_at`. Change the button label to "Resend" when cert was already sent. |

## Technical Details

**Current code (line 3341):**
```typescript
const canSend = fc.status === 'checked_out' && !fc.survey_completed_at;
```

**Updated code:**
```typescript
const canSend = fc.status === 'checked_out';
```

The button label will change dynamically:
- Shows "Send" when `survey_completed_at` is null
- Shows "Resend" when `survey_completed_at` is already set

No other files or logic need to change -- the send handler already updates `survey_completed_at` after sending, so resending simply overwrites the timestamp.

