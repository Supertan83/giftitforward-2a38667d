

# Fix: QR Cards Not Visible (1,000 Row Limit)

## Problem
You created 2,000 QR cards on Feb 18, but many are not visible in the app. The cards are **still safely in the database** (2,100 total) -- nothing was deleted.

## Root Cause
The database has a default limit of 1,000 rows per query. The `useQRCards` hook fetches cards with no explicit limit, so it silently caps at 1,000. Since cards are sorted newest-first, the older batch of Feb 18 cards falls beyond the cutoff.

## Solution
Update the `useQRCards` data hook to fetch cards in pages or raise the limit so all cards are returned. Additionally, add pagination to the QR Code Generator's "Registered" tab so large card sets are navigable.

## Technical Details

### 1. Update `useQRCards` hook (`src/hooks/useSupabaseData.ts`)
- Add `.limit(5000)` or use range-based pagination to fetch all cards
- Since `useQRCards` is used across many components (employee dashboard, exit zone, unblock zone, statistics, sync panel), raising the limit is the simplest fix

### 2. Add pagination to QR Code Generator registered tab (`src/components/admin/QRCodeGenerator.tsx`)
- Add server-side pagination with page controls (next/previous, page size selector)
- Show total card count so admins know how many exist
- This prevents performance issues when rendering thousands of cards in a table

### 3. Batch-based filtering (existing feature enhancement)
- The registered tab already groups by `registration_batch` -- ensure this grouping works with the full dataset
- Allow filtering by batch so admins can quickly find the Feb 18 batch

This fix will make all 2,100 cards visible immediately.
