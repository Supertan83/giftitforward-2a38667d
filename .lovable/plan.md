

## Add Missing April 2026 Marketplace Events

### Summary
The PDF contains 10 marketplace events for April 2026. Five already exist in the database; five are missing. I will insert the missing events using the database insert tool.

### Existing Events (no action needed)
1. Women Community Workers Marketplace – Morning Event (Apr 11)
2. Men's Construction & Facility Workers Marketplace – Afternoon Event (Apr 12)
3. Men's Aviation Workers Marketplace – Morning Event (Apr 15)
4. Taxi Drivers' Marketplace – Morning Event (Apr 18)
5. Taxi Drivers' Marketplace – Afternoon Event Day 2 (Apr 19)

### Events to Insert (5 missing)

| # | Name | Date | Time | Location |
|---|------|------|------|----------|
| 1 | Women Community Workers Marketplace Afternoon Event | 2026-04-11 | 17:30–21:00 | Dubai, Al Quoz |
| 2 | Mens Construction Facility Workers Marketplace Morning Event | 2026-04-12 | 08:30–14:00 | Dubai, Jebel Ali Industrial Area |
| 3 | Mens Aviation Workers Marketplace Afternoon Event | 2026-04-15 | 14:00–18:30 | Dubai, Muhaisnah |
| 4 | Taxi Drivers Marketplace Afternoon Event | 2026-04-18 | 15:00–20:30 | Dubai, Muhaisnah 4, Gate 4 |
| 5 | Taxi Drivers Marketplace Morning Event Day 2 | 2026-04-19 | 08:30–14:30 | Dubai, Muhaisnah 4, Gate 4 |

### Technical Details
- Use the Supabase insert tool to run a single `INSERT INTO marketplace_events` statement with all 5 rows
- Set `status = 'upcoming'`, `beneficiary_credit_limit = 15` (default), `max_items_per_scan = 1` (default)
- Match naming conventions of existing events (no apostrophes/special chars, consistent formatting)

