

# Fix "Missing Email" Tab and Clean Up Duplicate Data

## The Problem

The "Missing Email" tab currently shows 10 records, but only **3** have actual missing/placeholder emails. The other **7** have valid emails but are stuck with `status = 'pending'` because they're duplicates that weren't merged into existing approved accounts.

**Example - Paula Mfume has 2 records:**
- ✅ Approved record (with user account created)
- ❌ Pending record (duplicate, should have been merged)

## Solution Overview

### Part 1: Fix the Tab Filtering
Update the "Missing Email" tab to **only** show records with placeholder emails (`@placeholder.invalid`).

### Part 2: Auto-Merge Pending Duplicates
The 7 records with valid emails need to be merged into their existing approved accounts (adding any new events) and then deleted.

---

## Technical Implementation

### Step 1: Update Filter Logic

In `PendingVolunteers.tsx`, modify the query for "Missing Email" tab:

```text
Current:
  query.eq('status', 'pending')

New:
  query.eq('status', 'pending')
       .like('email', '%@placeholder.invalid')
```

This ensures only actual missing email cases appear.

### Step 2: Database Cleanup Script

Execute SQL to merge events from pending duplicates into approved records, then delete the duplicates:

```text
For each pending record with a valid email:
1. Find matching approved record by email
2. Merge any new events from pending into approved
3. Delete the pending duplicate
```

Affected records (7 duplicates to merge/delete):
- Paula Mfume (paula.mfume@alshaya.com)
- Nelleh Orano (nelleh.orano@dhgroupservices.com)
- Yasmin Nasheeth (yasmin.nasheeth@dhgroupservices.com)
- John Paul Jesudoss (john.jesudoss@jumeirah.com)
- TEST LN (testmail@mail.com)
- Juvelle Villareal (juvelle.villareal-c@dubaiholding.com)
- Princess Sweena Villaluz (development@thesurpluss.com)

### Step 3: Update Tab Count Badge

Ensure the count badge for "Missing Email" tab reflects only placeholder email records.

---

## Expected Result

After implementation:
- **"Missing Email" tab** will show only 3 records (Maria Moreno, Manal Essam, Oshin Nicola Menezes) - all with placeholder emails needing the "Add Email" workflow
- **Duplicate pending records** will be cleaned up, with their event data merged into existing approved accounts

