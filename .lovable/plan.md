I found the likely cause of the “0” allocation display:

- Today’s active GIF marketplace is `She Thrives: Women Workers Marketplace - Morning Event`.
- It currently has no Tractor link (`external_id` is empty), so the GIF allocation screen cannot pull Tractor allocations for it.
- A separate newly-created duplicate marketplace exists from the Tractor import: `Women In Facilities Management Marketplace Morning Event` with Tractor `external_id = 42`, but it is not the active marketplace selected in the screenshot.
- Because the selected active marketplace is unlinked, its `marketplace_item_allocations` total is correctly showing `0` locally.

Plan to fix after approval:

1. Confirm the correct Tractor event mapping
   - Verify that Tractor event `42` is the correct event for today’s Morning marketplace.
   - If confirmed, link `external_id = 42` to the active GIF marketplace: `She Thrives: Women Workers Marketplace - Morning Event`.

2. Clean up the duplicate marketplace record safely
   - If the duplicate `Women In Facilities Management Marketplace Morning Event` has no cards, transactions, or allocations, soft-delete it.
   - If it has any related records, move/link them safely before soft-deleting.

3. Sync allocations from Tractor into GIF
   - Run the existing allocation sync for today’s Morning marketplace.
   - This should create/update `marketplace_item_allocations` and item rows from Tractor allocation materials.
   - Re-check the allocation totals so the admin screen no longer shows `0`.

4. Fix today’s scan limit configuration
   - Today’s Morning marketplace is still set to `max_items_per_scan = 1`.
   - Set it to `22` to avoid yesterday’s repeated scan/manual entry issue.
   - Keep `beneficiary_credit_limit = 22`.

5. Prevent this from happening again
   - Update the Tractor marketplace linking logic so it does not create a duplicate event when Tractor uses a different title.
   - Add safer matching using event date/time and existing active/upcoming marketplaces, not only fuzzy name matching.
   - Improve the sync button feedback so admins see “Marketplace is not linked to Tractor” instead of silently seeing `0`.

Technical details:

```text
Current active marketplace:
- id: a2d85409-96f2-458e-9c5f-53d0a3100f67
- name: She Thrives: Women Workers Marketplace - Morning Event
- date: 2026-04-26
- status: active
- external_id: NULL
- allocation rows: 0
- max_items_per_scan: 1
- beneficiary_credit_limit: 22

Likely duplicate imported from Tractor:
- id: 93d755de-bc6a-450c-9327-cb101c4372b5
- name: Women In Facilities Management Marketplace Morning Event
- external_id: 42
- allocation rows: 0
```

Expected result:

- The selected Morning marketplace will show the actual Tractor allocation quantities instead of `0`.
- QR distribution can use up to 22 items per scan/session as intended.
- The duplicate/unlinked marketplace issue will be reduced for future Tractor imports.