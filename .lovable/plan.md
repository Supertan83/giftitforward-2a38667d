

# Add "Pending Volunteers (CE Module Incomplete)" recipient option

## What
Add a new option in the Email Campaign recipients dropdown: **"Pending – CE Module Incomplete"** that targets approved volunteers who have NOT completed the training module (`training_completed = false` or `null`).

## Changes

### `src/components/admin/EmailCampaignManager.tsx`

1. **Update type** for `formRecipientType` state from `'all' | 'marketplace' | 'manual'` to include `'pending_training'`.

2. **Add dropdown option** (line ~641):
   ```
   <SelectItem value="pending_training">Pending – CE Module Incomplete</SelectItem>
   ```

3. **Add recipient resolution** (after line ~182, in `createCampaign` mutation): query `pending_volunteers` with `status = 'approved'` and `training_completed = false` (or null):
   ```typescript
   } else if (formRecipientType === 'pending_training') {
     const { data: volunteers } = await supabase
       .from('pending_volunteers')
       .select('id, first_name, last_name, email')
       .eq('status', 'approved')
       .or('training_completed.is.null,training_completed.eq.false');
     recipientsList = (volunteers || []).map(v => ({ ... }));
   }
   ```

4. **Mirror the same logic** in the `updateCampaign` mutation's recipient filter building (around line ~339) and in the edit form restore logic (line ~326) so `pending_training` round-trips correctly.

