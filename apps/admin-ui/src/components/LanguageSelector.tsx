'use client';

import { i18n } from '@/i18n';
import { useLanguage } from '@/components/useLanguage';
import { useRef } from 'react';
import Image from 'next/image'

import styles from './LanguageSelector.module.css';

type Language = keyof typeof i18n;

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const entries = Object.entries(i18n) as [Language, typeof i18n[Language]][];
  const current = i18n[language];
  const detailsRef = useRef<HTMLDetailsElement>(null as unknown as HTMLDetailsElement);

  const handleChange = (code: Language) => {
    setLanguage(code);
    // Close the dropdown after selection
    if (detailsRef.current) {
      detailsRef.current.removeAttribute('open');
    }
  };

  return (
    <fieldset className={styles.container}>
      <b className="lang-selector-label">Language</b>
      <details ref={detailsRef} className={styles.dropdown}>
        <summary className={styles.trigger} role="button" aria-label="Open language menu">
                    <span className={styles.current}>
                        <Image src={`https://cdn.ipregistry.co/flags/emojitwo/${current.flag}.svg`} alt="" width={24} height={24} />
                      {current.langName} {current.flag}
                    </span>
          <span className={styles.caret} aria-hidden>▾</span>
        </summary>
        <div className={styles.menu} role="radiogroup" aria-label="Language selector">
          {entries.map(([code, data]) => (
            <label key={code} className={styles.option} data-selected={language === code || undefined}>
              <Image src={`https://cdn.ipregistry.co/flags/emojitwo/${data.flag}.svg`} alt="" width={24} height={24}/>
              <span>{data.langName}</span>
              <input
                className={styles.radio}
                type="radio"
                name="language"
                value={code}
                checked={language === code}
                onChange={() => handleChange(code)}
              />
            </label>
          ))}
        </div>
      </details>
    </fieldset>
  );
};

export default LanguageSelector;
