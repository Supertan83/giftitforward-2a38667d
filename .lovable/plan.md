

# Two-Way Sync: Gift App ↔ Tractor (Surpluss) Allocations — IMPLEMENTED

## Fix Applied: Material-Level Sync (not container-level)

All reverse-sync operations (delete, edit, return) now use `batch_update` with the specific `external_material_id` + marketplace `external_id` instead of container-level `delete_allocation`/`update_allocation` which was wiping ALL items in a Surpluss allocation container.

- **Delete**: Calls `batch_update` with `amount: 0` for just the one material
- **Edit**: Calls `batch_update` with the new amount for just the one material
- **Return to warehouse**: Calls `batch_update` with the reduced amount for just the one material
