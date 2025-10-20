'use client';

import Link from 'next/link';

import { useLanguage } from '@/components/useLanguage';

import styles from './NavBar.module.css';

export const NavBar = () => {
  const pages = [
    ['home', ''],
    ['users', 'users'],
    ['about', 'about']
  ];
  const { language } = useLanguage();
  // page name is in the current language via i18n mapping
  // list the pages with links to the correct language path
  return <nav className={styles.NavBar}>
    {pages.map(([name, path]) => (
      <Link key={path} href={`/${language}/${path}`}>
        {name}
      </Link>
    ))}
  </nav>;
};