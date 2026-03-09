

# Create `pending_beneficiaries` Table

## Problem
The `sync-surpluss-beneficiaries` edge function queries a `pending_beneficiaries` table that doesn't exist yet.

## What the edge function expects
From analyzing the code, these columns are referenced:
- `id` (uuid, PK)
- `unique_id` (text) — beneficiary identifier
- `qr_id` (text) — fallback identifier
- `gender` (text)
- `nationality` (text)
- `marital_status` (text)
- `children_count` (integer)
- `items_collected` (integer)
- `marketplace_event_id` (uuid) — links to marketplace_events
- `marketplace_id` (uuid) — fallback marketplace link
- `beneficiary_type_id` (integer) — used for demographics aggregation
- `age_*_count` fields (integer) — age group demographics
- `created_at`, `updated_at` (timestamptz)

## Changes

### 1. Database migration — Create `pending_beneficiaries` table
Create the table with all columns referenced by the edge function, enable RLS, and add staff/admin policies matching the existing pattern.

### 2. No code changes needed
The edge function already queries this table correctly. Once created, syncs will work.

