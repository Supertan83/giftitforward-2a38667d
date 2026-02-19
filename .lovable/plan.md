

# Fix Survey Email Banner to Match Welcome Email

## Problem
The "Thank You for Volunteering" survey email uses the **training module banner** (`training-module-banner.jpg`) as its hero image, while all other emails (welcome, certificate, campaign) use the correct **GIF hero banner** (`gif-hero-banner.jpg`). This inconsistency is confusing volunteers.

## Change

**File:** `supabase/functions/send-survey/index.ts` (line 189)

Replace:
```
training-module-banner.jpg
```
With:
```
gif-hero-banner.jpg
```

This single-line change aligns the survey email's hero banner with the welcome email and all other branded communications. The `?v=2` cache-bust parameter will also be kept consistent.

