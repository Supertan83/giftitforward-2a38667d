

## Add English/Arabic Language Toggle to Survey Pages

### Overview
Add a language toggle (English / Arabic) to both the Volunteer Survey and External Survey pages. When Arabic is selected, the page switches to RTL layout and displays Arabic question text.

### Database Change
Add two new columns to the `survey_questions` table:
- `question_text_ar` (text, nullable) -- Arabic translation of the question
- `options_ar` (jsonb, default '[]') -- Arabic translations of multiple-choice options

### Admin: Survey Question Builder Update
Update `src/components/admin/SurveyQuestionBuilder.tsx` to show an "Arabic Text" input field below each question's English text, and an "Arabic Options" section for multiple-choice questions. This lets admins enter translations when creating/editing questions.

### Survey Pages: Language Toggle
Update both `src/pages/VolunteerSurveyPage.tsx` and `src/pages/ExternalSurveyPage.tsx`:

1. Add a language state (`en` | `ar`) with a toggle button in the header (e.g., "EN | AR" toggle or "عربي / English" button)
2. When `ar` is selected:
   - Set `dir="rtl"` on the page container
   - Display `question_text_ar` instead of `question_text` (fall back to English if Arabic is empty)
   - Display `options_ar` instead of `options` for multiple-choice questions
   - Translate static UI strings (title, button labels, placeholders) to Arabic
3. Fetch `question_text_ar` and `options_ar` alongside existing fields from the database

### Static UI Translations
A simple translations object will handle the fixed strings:
- Page title: "استبيان ملاحظات المتطوعين"
- "Please share your experience" -> "يرجى مشاركة تجربتك"
- "Submit & Get Certificate" -> "إرسال والحصول على الشهادة"
- "Enter your answer..." -> "...أدخل إجابتك"
- Yes/No -> نعم / لا
- Full Name / Email placeholders
- Certificate section strings

### Files Changed
1. **Database migration** -- add `question_text_ar` and `options_ar` columns
2. **`src/components/admin/SurveyQuestionBuilder.tsx`** -- add Arabic text inputs in add/edit forms
3. **`src/pages/VolunteerSurveyPage.tsx`** -- add language toggle + RTL support + Arabic rendering
4. **`src/pages/ExternalSurveyPage.tsx`** -- same language toggle + RTL support + Arabic rendering

