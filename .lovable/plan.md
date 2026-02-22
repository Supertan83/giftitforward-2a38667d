

# PDF Download for Survey Reviews

## What This Does
Adds two download options to the Survey Reviews section:
1. **Download All** button in the header -- exports all currently visible surveys as a single PDF report
2. **Download** button on each individual survey card -- exports that single survey as a PDF

## How It Will Look
- A "Download PDF" button with a download icon appears next to the "Survey Reviews" title
- Inside each expanded survey accordion, a small "Download" button appears at the bottom of the answers
- The PDF will be a clean, formatted document showing the volunteer name, date, source type, and all question/answer pairs

## Technical Details

### Changes to `src/components/admin/SurveyReviewsViewer.tsx`

- Import `jsPDF` (already installed in the project)
- Import `Download` icon from lucide-react
- Add a helper function `generateSurveyPDF(surveys, questionMap)` that:
  - Creates an A4 portrait PDF using jsPDF
  - Adds a "Survey Reviews Report" title with date
  - For each survey: prints name, completion date, source badge, then each question and answer
  - Handles page breaks automatically when content exceeds page height
  - Returns the jsPDF doc instance
- Add a "Download All" button in the header bar that calls `generateSurveyPDF` with all visible surveys and triggers `doc.save('survey-reviews.pdf')`
- Add a "Download" button inside each AccordionContent that calls `generateSurveyPDF` with just that single survey and saves as `survey-{name}.pdf`

### No other files need changes
- `jsPDF` is already a project dependency
- No backend changes needed -- PDF is generated client-side from already-fetched data

