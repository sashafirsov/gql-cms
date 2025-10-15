'use client';

import { useLocalStorage } from 'usehooks-ts';
import { i18n } from '../i18n';

type Language = keyof typeof i18n;
type TranslationKey = keyof typeof i18n.en;

export const useLanguage = () => {
  const [language, setLanguage] = useLocalStorage<Language>('language', 'en');

  const getText = (key: TranslationKey): string => {
    return i18n[language]?.[key] || i18n.en[key];
  };

  return {
    getText,
    setLanguage,
    language,
  };
};
