

## Fix: "Save Changes" silently fails when Beneficiary Credit Limit > 25

### Root cause (confirmed)
`src/components/admin/MarketplaceManagement.tsx` line 53:
```ts
beneficiary_credit_limit: z.number().min(15).max(25).optional()
```
The screenshot shows the admin entered **29 items/person**. Zod validation fails, `setErrors` is called, and `handleSaveEdit` returns early — no toast, no save, "nothing happens". The error message is rendered next to the field but is easy to miss; meanwhile the help text still says "Default: 15, Range: 15-25" so admins don't know 29 is rejected.

The DB column has no such constraint (`beneficiary_credit_limit integer NOT NULL DEFAULT 15`), so this is purely a frontend cap that no longer matches operational reality (admins now need higher per-person limits when extending marketplaces or for special distributions).

### Fix (1 file)

**`src/components/admin/MarketplaceManagement.tsx`**
1. Loosen the Zod rule to a sane operational range:
   ```ts
   beneficiary_credit_limit: z.number().int().min(1).max(100).optional()
   ```
2. Update both helper-text labels (create form ~line 729 and edit form ~line 889):
   - From: `Default: 15, Range: 15-25`
   - To: `Default: 15, Range: 1-100`
3. Add a fallback toast in `handleSaveEdit` / `handleCreate` so that if validation ever fails again, the admin sees a clear "Please fix the highlighted fields" destructive toast instead of nothing happening.

### What stays the same
- DB schema, RLS policies, edge functions — untouched
- Default value remains 15
- All other validation rules unchanged
- No data migration needed

### Outcome
Admins can save any reasonable per-person limit (e.g. 29), and if they ever enter an invalid value they'll get a visible toast instead of a silent no-op.

