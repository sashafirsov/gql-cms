'use client';

import { useLocalStorage } from 'usehooks-ts';
import { i18n } from '@/i18n';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';

type Language = keyof typeof i18n;

type TranslationKey = keyof (typeof i18n)[keyof typeof i18n];

const normalizeParamToLang = (param?: string): Language | undefined => {
  if (!param) return undefined;
  const lower = param.toLowerCase();
  // Map URL language codes to our i18n keys when needed
  const map: Record<string, Language> = {
    en: 'en',
  } as const;
  const candidate = (map[lower] ?? lower) as Language;
  return (candidate in i18n ? candidate : undefined) as Language | undefined;
};

export const useLanguage = () => {
  const params = useParams<{ lang?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramLang = normalizeParamToLang(params?.lang);

  // Persisted preference, default to 'en' (English)
  const [storedLang, setStoredLang] = useLocalStorage<Language>('language', 'en');

  // Priority: URL param > stored preference
  const language = (paramLang ?? storedLang ?? 'en') as Language;

  const getText = (key: TranslationKey): string => {
    const dict = i18n[language];
    if (dict && key in dict) return (dict as any)[key] as string;
    // Fallback to English
    return (i18n.en as any)[key] as string;
  };

  const setLanguage = (lang: Language) => {
    setStoredLang(lang);

    // Update the URL, changing only the language segment while preserving the rest of the path and query
    const currentPath = pathname || '/';
    const parts = currentPath.split('/').filter(Boolean);

    if (parts.length > 0 && parts[0] in i18n) {
      parts[0] = lang;
    } else {
      parts.unshift(lang);
    }

    const newPath = '/' + parts.join('/');
    const query = searchParams?.toString();
    const href = query ? `${newPath}?${query}` : newPath;

    router.push(href);
  };

  return {
    getText,
    setLanguage,
    language,
  };
};
