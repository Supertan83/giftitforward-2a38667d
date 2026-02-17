import { type SurveyLanguage } from '@/lib/surveyTranslations';

interface LanguageToggleProps {
  language: SurveyLanguage;
  onChange: (lang: SurveyLanguage) => void;
}

export const LanguageToggle = ({ language, onChange }: LanguageToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(language === 'en' ? 'ar' : 'en')}
    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
  >
    <span className={language === 'en' ? 'opacity-100' : 'opacity-50'}>EN</span>
    <span className="text-white/30">|</span>
    <span className={language === 'ar' ? 'opacity-100' : 'opacity-50'}>عربي</span>
  </button>
);
