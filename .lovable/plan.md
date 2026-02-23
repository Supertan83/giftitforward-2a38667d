

# Fix Survey Submission Error for Volunteers

## The Problem
When volunteer BRAHMPAL VERMA (and potentially others) opens the survey link from their email and tries to submit, they see: **"Submission Failed -- Edge Function returned a non-2xx status code"**.

## Root Cause
The `submit-survey` edge function is **not listed** in `supabase/config.toml` with `verify_jwt = false`. This means it defaults to requiring a valid JWT (login token). Since volunteers access the survey via a public email link and are **not logged in**, the function rejects the request.

The function already has its own security: it validates the unique `survey_token` before accepting any data. JWT verification is redundant and blocks legitimate survey submissions.

## The Fix

### 1. Add `submit-survey` to `supabase/config.toml`

Add this entry to disable JWT verification for the survey function:

```toml
[functions.submit-survey]
verify_jwt = false
```

### 2. Update survey page to use direct fetch instead of `supabase.functions.invoke()`

In `src/pages/VolunteerSurveyPage.tsx`, the submission call (line 133) currently uses:

```typescript
const { data, error } = await supabase.functions.invoke('submit-survey', {
  body: { surveyToken: token, answers },
});
```

This automatically attaches the (missing) auth token. Change it to a direct `fetch()` call (matching how the GET request on line 71 already works), so it does not try to attach auth headers:

```typescript
const res = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-survey`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surveyToken: token, answers }),
  }
);
const data = await res.json();
```

### 3. Same fix for the certificate-sent update call (line 194)

The `update-certificate-sent` action call also uses `supabase.functions.invoke`, which has the same auth issue. Switch it to direct `fetch()`.

### No database changes needed

The function's internal security (survey token validation) is already solid. This is purely a configuration and client-side fix.

## Status of BRAHMPAL VERMA
His survey shows as **completed** (at 05:45 UTC today), so he eventually managed to submit. But this fix will prevent the issue from recurring for him and other volunteers.

