## Diagnosis

**Card `QR-MLS1ZOLO-2TLF`:**
- Database truth right now: `status = checked_out`, `total_items_collected = 0`, marketplace = Afternoon event
- The screenshot (taken at 4:16 PM phone time) shows it `active` with `0/20` and `20 credits remaining` — that's a **stale page render** from before the 4:17 PM (Dubai) checkout. A page refresh would show "checked_out" correctly.
- So this isn't a UI bug — but it surfaces a much bigger operational problem ↓

**Systemic problem in the Afternoon event (`71792e7c-...`)** — confirmed via DB scan of all 153 active cards:
| Status | Items collected | # of cards |
|---|---|---|
| active | 0 items | **115** |
| active | 1–4 items | 2 |
| active | 5–14 items | 8 |
| active | 15+ items | 3 |
| checked_out | **0 items** | **29** |

→ **144 of 153 cards (94%)** show 0–4 scanned items. Volunteers are physically handing out items but **not scanning each one** (because `max_items_per_scan = 1` requires one scan per item, which is too slow at the table). The earlier `QR-MLTC4HWM-WJ1L` case (4 scans for 20 items) was not a one-off — it's the norm today.

---

## Plan

### Step 1 — Operational fix (immediate, prevents more data loss)
Raise `max_items_per_scan` for the Afternoon event from **1 → 20** so volunteers can enter the actual quantity (e.g. "20") in a single scan, matching how items are physically being handed out.

```sql
UPDATE marketplace_events 
SET max_items_per_scan = 20, updated_at = now()
WHERE id = '71792e7c-9f98-4103-bd26-0aec8e5f0ad6';
```

### Step 2 — Reconcile the 29 already-checked-out cards with 0 items
These beneficiaries already left with their items. Since checkout zeros out `total_items_collected`, we cannot recover individual counts. Two options:

**Option 2A (recommended):** Backfill each of the 29 checked-out cards to assume **20 items distributed** (full credit), insert a corresponding `Adjustment` transaction, and bump the marketplace allocation `distributed_quantity` by the total (29 × 20 = 580). This makes reporting accurate.

**Option 2B:** Leave them at 0 and accept the under-count in reports.

### Step 3 — Train volunteers (manual, you do this)
Brief the volunteers at the Afternoon event tables: **enter the quantity number on the scan screen** (now that we've raised the per-scan limit to 20), so each beneficiary's bag is recorded with one scan instead of 20.

### Step 4 — No code changes
The UI is working correctly. The "20 credits remaining / 0 collected" display is accurate for a freshly activated card. The screenshot of card `2TLF` was simply stale.

---

## Questions before I execute

1. **Confirm `max_items_per_scan = 20`** for the Afternoon event? (Or a different number like 10?)
2. **For the 29 cards already checked out at 0** — apply Option 2A (backfill to 20 each) or Option 2B (leave as-is)?
3. **Same fix for the Morning event?** It also has `max_items_per_scan = 1` and likely the same under-counting. Want me to raise it there too and audit the morning numbers?

Reply with your answers and I'll execute.
