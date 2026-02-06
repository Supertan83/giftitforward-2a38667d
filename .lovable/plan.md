

## Add Surpluss Distribution Items Endpoint

Create a dedicated backend endpoint that Surpluss can call to push distribution items (materials) into the GIF system, along with company info, material groups, and image URLs.

### What This Does

- Creates a new backend function `receive-surpluss-items` that accepts material data from the Surpluss platform
- Stores items with full details: ID, title, description, quantity, image URL, company info, material group, SDG goals, and more
- Secured with the existing `WEBHOOK_API_KEY` for authentication
- Reuses the existing `external_items`, `external_companies`, `external_addresses`, `external_material_groups`, and `external_sdg_goals` tables (no database changes needed)
- Items received through this endpoint will appear in the existing **External Items** viewer in the admin panel

### API Contract

The endpoint accepts POST requests with either a single item or an array of items matching the Surpluss Material model:

```text
POST /receive-surpluss-items
Header: x-api-key: <WEBHOOK_API_KEY>

Body (single or array):
{
  "id": 123,                          // Material ID (external_id)
  "uuid": "abc-def-...",              // UUID
  "title": "Office Furniture Set",    // Item name
  "description": "...",               // Description
  "active": true,
  "price": 0,
  "per": 1,
  "frequency": { "One-off": true },
  "image_url": "https://...",         // Item image
  "quantity": 50,
  "item_count": 50,
  "box_count": 5,
  "type": { "offering_type": "DONATION", "status": "APPROVED" },
  "condition_id": 1,
  "third_level_subcategory_id": null,
  "company": {                        // Donating company
    "id": 10,
    "uuid": "...",
    "name": "Acme Corp",
    "main_business": "Retail",
    "sector": "Consumer Goods",
    "company_size": "Large",
    "image_url": "https://...",
    ...
  },
  "address": {                        // Pickup/warehouse address
    "id": 5,
    "address": "123 Main St",
    "city": "Dubai",
    "country": "UAE",
    ...
  },
  "material_group": {                 // Material category
    "id": 3,
    "name": "Furniture",
    "code": "FUR",
    "uom": "piece"
  },
  "sdg_goals": [                      // SDG goals (optional)
    { "id": 1, "name": "No Poverty", "code": "SDG1" }
  ]
}
```

### Technical Details

**Step 1: Create Edge Function `receive-surpluss-items`**

New file: `supabase/functions/receive-surpluss-items/index.ts`

- Validates `x-api-key` header against `WEBHOOK_API_KEY` secret
- Accepts both single object and array payloads
- Reuses the exact same upsert logic already in `webhook-receiver` for external items:
  - Upserts company into `external_companies`
  - Upserts address into `external_addresses`
  - Upserts material group into `external_material_groups`
  - Upserts SDG goals into `external_sdg_goals`
  - Upserts item into `external_items` with all foreign key references
  - Links SDG goals via `external_item_sdg_goals`
- Logs a webhook event into `webhook_events` with `source_identifier = 'surpluss_items'` for audit trail
- Returns a summary: total received, processed, failed, with per-item details

**Step 2: Register in `supabase/config.toml`**

Add the function with `verify_jwt = false` (it uses API key auth instead).

**Step 3: Add Webhook Testing Preset**

Update `WebhookTestingTool.tsx` to include a "Surpluss Item" preset payload so admins can test the endpoint from the admin panel.

### No Database Changes Required

The existing tables (`external_items`, `external_companies`, `external_addresses`, `external_material_groups`, `external_sdg_goals`, `external_item_sdg_goals`) already match the Surpluss Material model perfectly. The `ExternalItemsViewer` will display incoming items automatically.

### Files Created/Modified

- **New**: `supabase/functions/receive-surpluss-items/index.ts`
- **Modified**: `supabase/config.toml` -- register new function
- **Modified**: `src/components/admin/WebhookTestingTool.tsx` -- add test preset

