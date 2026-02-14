

# Survey Question Builder - Admin Panel

## Overview
Create a new admin section called **"Survey Questions"** where you can fully customize the external survey questions: add, edit, reorder, and delete questions with different answer types (text, yes/no, multiple choice, rating scale).

## How It Works

1. **New database table** `survey_questions` stores all customizable questions
2. **New admin panel section** "Survey Questions" in Admin Apps lets you manage questions with a drag-and-drop style interface
3. **The public survey page** (`/survey`) dynamically loads questions from the database instead of showing hardcoded ones
4. **Responses stored as JSON** in the existing `external_survey_responses` table (new `answers` JSONB column)

## Question Types Available
- **Short Text** - single line input
- **Long Text** - multi-line textarea
- **Yes/No** - radio buttons (Yes / No)
- **Multiple Choice** - radio buttons with custom options you define
- **Rating Scale** - 1-5 star or number rating

## Admin Interface Features
- Add new questions with a title, type, and required/optional toggle
- Edit question text and type inline
- Reorder questions with up/down arrows
- Delete questions with confirmation
- Preview how the survey looks
- For multiple choice: add/remove answer options

## Technical Details

### Database Changes

**New table: `survey_questions`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| question_text | text | The question shown to volunteers |
| question_type | text | `short_text`, `long_text`, `yes_no`, `multiple_choice`, `rating` |
| options | jsonb | For multiple choice: array of option strings |
| is_required | boolean | Whether the question must be answered |
| sort_order | integer | Display order |
| is_active | boolean | Show/hide without deleting |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

RLS: Admins can manage, anyone can read active questions (for the public survey page).

**Alter table: `external_survey_responses`**
- Add column `answers` (jsonb) to store dynamic question responses as `{ "question_id": "answer_value" }` pairs

### New Files
- `src/components/admin/SurveyQuestionBuilder.tsx` -- the admin CRUD interface for managing questions
- Sidebar entry added to Admin Apps section

### Modified Files
- `src/components/admin/AdminSidebar.tsx` -- add "Survey Questions" menu item + new view type
- `src/components/admin/AdminDashboard.tsx` -- register the new view in the switch/case
- `src/pages/ExternalSurveyPage.tsx` -- fetch questions dynamically from `survey_questions` table, render based on type, submit answers as JSON
- `supabase/functions/submit-external-survey/index.ts` -- accept and store the new `answers` JSONB field

### Data Migration
The three existing hardcoded questions will be seeded into the `survey_questions` table so nothing is lost.

