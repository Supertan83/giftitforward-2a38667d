

# Replace `sync-surpluss-volunteer-beneficiary` with uploaded code

## What changed in the uploaded `tester.ts`

Compared to the current edge function, the uploaded file has these differences:

1. **Enhanced demographics logging** — extensive `console.log` statements with emoji markers throughout the demographics matching and update section (steps 7+), including raw response structure inspection, normalized name debugging, and match type reporting.

2. **Improved "already exists" audit log fix** — instead of blindly updating the most recent failed log, it now fetches by `id` first and updates by `id` (more precise).

3. **Empty demographics guard** — skips the API call entirely if the demographics payload has no keys, logging a warning.

4. **Richer error messages** — extracts `message` from JSON error responses for clearer audit logging.

5. **No-match debugging** — when no Surpluss event ID is found, logs detailed diagnostic info and adds the error to `allErrors`.

6. **Local server footer** — lines 505-507 add `{ port: 8000 }` and a console log for local testing. These must be **removed** for the deployed edge function (Deno serve in Supabase doesn't use port config).

## Plan

1. **Replace** `supabase/functions/sync-surpluss-volunteer-beneficiary/index.ts` with the full content of `tester.ts`, but **strip lines 505-507** (the `{ port: 8000 }` option and the startup console.log) since Supabase edge functions don't support custom port binding — the `serve()` call should close with just `});`.

One file changed, no database or config changes needed.

