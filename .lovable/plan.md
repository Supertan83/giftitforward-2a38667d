

## Filter Marketplace Dropdown to Active Events Only

The registration page currently fetches all marketplace events. It should only show events with `status = 'active'`.

### Change

**File: `src/pages/OnsiteRegistrationPage.tsx`** (line ~44)

Add `.eq('status', 'active')` to the marketplace query:

```typescript
const { data } = await supabase
  .from('marketplace_events')
  .select('id, name')
  .eq('status', 'active')
  .order('event_date', { ascending: false });
```

One line added. No other changes needed.

