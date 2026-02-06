

## Fix: Route Surpluss Item Tests to the Correct Endpoint

The "Surpluss Item" preset in the Webhook Testing Tool currently sends requests to `webhook-proxy`, which forwards them to `webhook-receiver`. But the `receive-surpluss-items` edge function is a completely separate endpoint.

### The Fix

Update `WebhookTestingTool.tsx` so that when the **"Surpluss Item"** payload type is selected, the request is sent directly to:

```
https://zrzlzggixuogpxberdxt.supabase.co/functions/v1/receive-surpluss-items
```

instead of the default `webhook-proxy` URL.

### Technical Details

**File: `src/components/admin/WebhookTestingTool.tsx`**

In the `handleTest` function (around line 184), add logic so that if `payloadType === 'surpluss_item'`, the target URL is set to the `receive-surpluss-items` endpoint directly, bypassing the proxy URL and source identifier logic.

The `?source=` parameter is not needed for this endpoint since it logs its own `source_identifier = 'surpluss_items'` automatically.

No other files need to change.
