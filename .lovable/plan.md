

## Fix Live Statistics Dashboard UI

### Problems identified
1. The "Items by Category" pie chart renders inline labels for dozens of items, causing massive text overlap
2. The horizontal bar chart has a narrow Y-axis (80px) that truncates long item names like "Food Storage & Carrying Products"
3. Too many data points crammed into both charts without any limit

### Fix approach

**File: `src/components/admin/StatisticsDashboard.tsx`**

**1. Fix the Pie Chart (Items by Category)**
- Remove the `label` prop from the Pie component — no more inline text labels
- Limit data to top 10 categories to keep the legend readable
- Add `wrapperStyle={{ fontSize: 12 }}` to Legend for readability
- Keep the Tooltip for hover details

**2. Fix the Bar Chart (Distribution by Item Type)**
- Limit to top 10 items
- Increase Y-axis `width` from 80 to 120
- Truncate long names in the tick with an ellipsis (max ~18 chars)
- Increase chart height from 300px to 400px to give more vertical space

**3. Add a "remaining" aggregation**
- For both charts, if there are more than 10 categories, sum the rest into an "Others" bucket so data isn't lost

### Result
Clean, readable charts with no overlapping text. All data still accessible via tooltips and a consolidated "Others" category.

