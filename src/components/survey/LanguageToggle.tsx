import { type SurveyLanguage } from '@/lib/surveyTranslations';

interface LanguageToggleProps {
  language: SurveyLanguage;
  onChange: (lang: SurveyLanguage) => void;
}

export const LanguageToggle = ({ language, onChange }: LanguageToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(language === 'en' ? 'ar' : 'en')}
    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-muted text-sm font-medium text-foreground hover:bg-accent transition-colors"
  >
    <span className={language === 'en' ? 'opacity-100' : 'opacity-50'}>EN</span>
    <span className="text-muted-foreground">|</span>
    <span className={language === 'ar' ? 'opacity-100' : 'opacity-50'}>عربي</span>
  </button>
);
