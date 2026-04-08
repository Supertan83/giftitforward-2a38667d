

## Add Dash Separator to Marketplace Event Names

### What's changing
Update all 10 upcoming marketplace event names to include " - " between the marketplace name and the event timing descriptor.

### Names to update

| Current | New |
|---------|-----|
| Women Community Workers Marketplace Morning Event | Women Community Workers Marketplace - Morning Event |
| Women Community Workers Marketplace Afternoon Event | Women Community Workers Marketplace - Afternoon Event |
| Mens Construction Facility Workers Marketplace Morning Event | Mens Construction Facility Workers Marketplace - Morning Event |
| Mens Construction Facility Workers Marketplace Afternoon Event | Mens Construction Facility Workers Marketplace - Afternoon Event |
| Mens Aviation Workers Marketplace Morning Event | Mens Aviation Workers Marketplace - Morning Event |
| Mens Aviation Workers Marketplace Afternoon Event | Mens Aviation Workers Marketplace - Afternoon Event |
| Taxi Drivers Marketplace Morning Event | Taxi Drivers Marketplace - Morning Event |
| Taxi Drivers Marketplace Afternoon Event | Taxi Drivers Marketplace - Afternoon Event |
| Taxi Drivers Marketplace Morning Event Day 2 | Taxi Drivers Marketplace - Morning Event Day 2 |
| Taxi Drivers Marketplace Afternoon Event Day 2 | Taxi Drivers Marketplace - Afternoon Event Day 2 |

### Technical approach
- Single SQL `UPDATE` using `REPLACE` pattern: replace `"Marketplace Morning"` → `"Marketplace - Morning"` and `"Marketplace Afternoon"` → `"Marketplace - Afternoon"` for all upcoming events
- Only affects the `marketplace_events` table `name` column
- No code changes needed

