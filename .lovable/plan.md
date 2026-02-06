

## Email Template Control Center

Build a centralized system where admins can create and manage reusable email templates. All templates share the same branded structure (header, footer, fonts, colors) -- only the content sections and images are editable. Templates support dynamic placeholders (like `{{first_name}}`, `{{marketplace_date}}`) that get replaced with real data at send time.

### What You Get

- A new "Email Templates" section in the Admin panel
- Ability to create templates for different purposes: Welcome, Reminder, Rejection, Approval, Follow-up, Custom
- A rich form to define subject line, greeting, body sections, and call-to-action buttons
- Dynamic placeholder tokens (e.g. `{{first_name}}`, `{{event_date}}`) that auto-fill with real data
- Live preview showing exactly how the email will look
- All templates share the same branded Dubai Holding / Gift It Forward layout (hero image, logo footer, fonts, colors)

### How It Works

1. Admin opens "Email Templates" from the sidebar
2. Clicks "New Template" -- picks a category (Reminder, Rejection, Approval, etc.)
3. Fills in: Subject line, greeting text, body paragraphs, optional CTA button text/URL, optional image
4. Inserts dynamic tokens from a clickable token list (e.g. click `{{first_name}}` to insert it)
5. Previews the email in the branded layout
6. Saves the template -- it's stored in the database and available for future use

---

### Technical Details

**Step 1: Database Table**

Create an `email_templates` table:

```text
- id (uuid, PK)
- name (text) -- internal template name, e.g. "Marketplace Reminder"
- category (text) -- 'welcome' | 'reminder' | 'rejection' | 'approval' | 'followup' | 'custom'
- subject (text) -- email subject line, supports tokens
- greeting (text) -- e.g. "Dear {{first_name}},"
- body_sections (jsonb) -- array of content blocks: [{ type: 'paragraph'|'list'|'cta'|'image', content: ... }]
- cta_text (text, nullable) -- call-to-action button label
- cta_url (text, nullable) -- call-to-action button URL
- is_active (boolean, default true)
- created_by (uuid, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

RLS: Admins can manage (ALL), Staff can view (SELECT).

**Step 2: Hook -- `useEmailTemplates.ts`**

New file `src/hooks/useEmailTemplates.ts`:
- `useEmailTemplates(category?)` -- fetch all templates, optionally filtered by category
- `useEmailTemplate(id)` -- fetch a single template
- `createEmailTemplate` mutation
- `updateEmailTemplate` mutation
- `deleteEmailTemplate` mutation

**Step 3: Template Builder UI -- `EmailTemplateCenter.tsx`**

New file `src/components/admin/EmailTemplateCenter.tsx`:

- **Template List View**: Table of all templates showing name, category, status, last updated. Actions: Edit, Preview, Duplicate, Delete.
- **Template Editor**: Form with:
  - Template name and category selector
  - Subject line input
  - Greeting text input
  - Body sections editor (add/remove/reorder paragraph blocks, list blocks, CTA blocks)
  - Dynamic Token Palette: a clickable list of available tokens like `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{marketplace_name}}`, `{{marketplace_date}}`, `{{marketplace_location}}`, `{{marketplace_time}}`, `{{qr_card_id}}`, `{{login_url}}`, `{{training_url}}`. Clicking a token inserts it at the cursor position.
- **Live Preview Panel**: Shows the full branded email layout (hero banner, "Execution Partner" label, title, body content with tokens shown as highlighted chips, Dubai Holding footer) -- updating in real time as the admin types.

**Step 4: Branded Layout Renderer**

Create a shared `EmailTemplatePreview` component that wraps any template content in the standard branded shell:
- Hero banner image (from email-assets bucket)
- "Execution Partner" label
- Template subject as title
- Dynamic body sections rendered in order
- CTA button with brand red color
- Dubai Holding logo footer with "For the Good of Tomorrow" tagline

This reuses the exact same structure/fonts/colors as the existing welcome email preview.

**Step 5: Register in Admin**

- Add `'email-templates'` to the `AdminView` type
- Add sidebar item under "Admin Apps" section (with a `FileText` icon)
- Render `EmailTemplateCenter` when that view is active

**Step 6: Available Dynamic Tokens**

The system supports these tokens out of the box:

| Token | Description |
|---|---|
| `{{first_name}}` | Volunteer's first name |
| `{{last_name}}` | Volunteer's last name |
| `{{full_name}}` | Full name |
| `{{email}}` | Volunteer's email |
| `{{phone}}` | Phone number |
| `{{marketplace_name}}` | Event name |
| `{{marketplace_date}}` | Event date |
| `{{marketplace_time}}` | Event timings |
| `{{marketplace_location}}` | Event location |
| `{{qr_card_id}}` | Volunteer QR card ID |
| `{{login_url}}` | Platform login link |
| `{{training_url}}` | Training module link |
| `{{current_date}}` | Today's date |

Admins can also type custom tokens using the `{{custom_field}}` syntax.

### Files Created/Modified

- **New migration**: `email_templates` table with RLS
- **New**: `src/hooks/useEmailTemplates.ts`
- **New**: `src/components/admin/EmailTemplateCenter.tsx`
- **Modified**: `src/components/admin/AdminDashboard.tsx` -- add view case
- **Modified**: `src/components/admin/AdminSidebar.tsx` -- add sidebar item
