## What's actually happening

I tested the backend directly. **The Surpluss sync functions do work** — but they're slow and the UI gives almost no feedback, so it looks like the button is broken.

For the Women Community Workers Marketplace - Morning Event:
- Volunteer/demographics sync: ~5s, success ✓
- Beneficiary sync: **~30s**, 177 sent + 226 skipped (out of 403) ✓
- Distribution report: extra call after that

During this 30+ seconds the button just shows a tiny spinner with no other indication. If the user navigates away, refreshes, or the request times out on a flaky connection, nothing happens visibly and they conclude the button is "not working".

There's also a real bug: in `useSurplussVolunteerBeneficiarySync.ts`, **if the first call (volunteers) throws, no toast is fired with details** — only a generic "Sync Failed" message. And the second call's huge response (~2,300 lines JSON) is parsed entirely on the main thread, which can briefly freeze the UI.

## Fix

### 1. Add real progress feedback
Show step-by-step progress inside the button / a small inline status, not just a spinner:
- "Syncing volunteers… (1/3)"
- "Syncing beneficiaries… (2/3)"
- "Reporting distribution… (3/3)"

Implemented by adding a `currentStep` state in `useSurplussVolunteerBeneficiarySync` and surfacing it in `MarketplaceReports.tsx` next to the button.

### 2. Better error surfacing
In the hook's `catch`, include which step failed and the underlying message in the toast (currently the generic catch swallows useful info from the FunctionsHttpError body). Read `error.context?.body` when present.

### 3. Prevent accidental double-clicks / navigation loss
- Keep `disabled={isSyncing}` (already present) ✓
- Add a confirmation dialog before starting: "This may take 30–60 seconds. Don't close the tab."

### 4. Remove dead Staging option (cosmetic)
The select shows only "Production" but the state type is `'staging' | 'production'`. Either re-add a Staging item or simplify to a single button (cleaner). Recommend simplifying.

## Technical changes

- `src/hooks/useSurplussVolunteerBeneficiarySync.ts`
  - Add `currentStep: 'idle' | 'volunteers' | 'beneficiaries' | 'distribution'` state and expose it.
  - Wrap each `supabase.functions.invoke` call with a try/catch that captures `error.context?.body` and continues to next step where appropriate.
  - On final catch, include the step name in the toast description.
- `src/components/admin/MarketplaceReports.tsx`
  - Replace the small inline spinner label with dynamic text driven by `currentStep`.
  - Remove the `Select` (production-only) and keep just the button.
  - Optional: AlertDialog confirmation before starting.

## What this does NOT change
- No backend / edge function changes — they already succeed.
- No data is re-sent or duplicated; Surpluss API treats already-existing volunteers/beneficiaries as skipped (per existing memory).
