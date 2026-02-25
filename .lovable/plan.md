

## Bug: Unclear Error When Quantity Exceeds Remaining Credits

### Problem
When a volunteer selects quantity 3 but the beneficiary only has 2 credits remaining, the system shows **"Limit Reached! Maximum items already collected. 0/20"** -- which is confusing and incorrect. The "0/20" comes from hardcoded logic in the error handler that always displays `creditLimit - creditLimit = 0`.

### Root Cause
Two issues working together:

1. **Frontend error handler (MarketplaceZone.tsx, line 112-118)**: When the backend returns a "LIMIT" error, the UI sets `credits: creditLimit` and `creditLimit: creditLimit`. The FeedbackOverlay then calculates `creditLimit - credits = 0`, always showing "0/20 Credits Remaining" regardless of actual balance.

2. **Backend RPCs**: The batch RPC error message includes the actual numbers (`Would exceed maximum (18 + 3 > 20)`) but the frontend ignores them and shows a generic message.

### Fix (2 changes)

**1. Backend RPCs -- Improve error messages and return remaining credits**

Update both `distribute_marketplace_item` (single) and `distribute_marketplace_items_batch` to return a clearer error that includes the remaining credits:

- Single: Change `LIMIT REACHED (%/%). Maximum items already collected.` to include remaining info
- Batch: Change error to clearly state: `LIMIT: Selected quantity (3) exceeds remaining credits (2). Maximum allowed: 20.`

**2. Frontend (MarketplaceZone.tsx) -- Parse actual values from error and show clear message**

Update the error catch block to:
- Parse remaining credits from the error message when available
- Show the actual remaining credits in the feedback overlay (e.g., "18/20" not "0/20")
- Display a clear subtitle: "Selected quantity (3) exceeds remaining credits (2)." instead of generic "Maximum items already collected."

### Technical Details

**Backend SQL changes** (database migration):

For `distribute_marketplace_items_batch`:
```sql
-- Replace line 53:
RAISE EXCEPTION 'LIMIT: Selected quantity (%) exceeds remaining credits (%). Maximum: %.', 
  p_quantity, v_limit - v_card.credit_balance, v_limit;
```

For `distribute_marketplace_item` (single):
```sql
-- Replace line 42-43:
RAISE EXCEPTION 'LIMIT REACHED (%/%). Maximum items already collected.', 
  v_card.credit_balance, v_limit;
```
(Single stays the same since it only adds 1 -- the limit check is correct.)

**Frontend changes** (MarketplaceZone.tsx error handler):

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : 'Operation failed';
  const isLimit = message.includes('LIMIT');
  
  if (isLimit) {
    // Try to parse remaining credits from batch error
    const remainingMatch = message.match(/remaining credits \((\d+)\)/);
    const balanceMatch = message.match(/\((\d+)\/(\d+)\)/);
    const remaining = remainingMatch 
      ? parseInt(remainingMatch[1]) 
      : balanceMatch 
        ? parseInt(balanceMatch[2]) - parseInt(balanceMatch[1])
        : 0;
    
    setFeedback({
      type: 'error',
      title: 'Limit Reached!',
      subtitle: quantity > 1 
        ? `Selected quantity (${quantity}) exceeds remaining credits (${remaining}).`
        : 'Maximum items already collected.',
      credits: creditLimit - remaining,
      creditLimit,
    });
  } else {
    setFeedback({
      type: 'warning',
      title: 'Action Failed',
      subtitle: message,
    });
  }
}
```

### Files Changed
- **Database migration**: Update `distribute_marketplace_items_batch` RPC error message
- **src/components/zones/MarketplaceZone.tsx**: Parse error details and display actual remaining credits

### Result
- Before: "Limit Reached! Maximum items already collected. 0/20"
- After: "Limit Reached! Selected quantity (3) exceeds remaining credits (2). 2/20 Credits Remaining"
