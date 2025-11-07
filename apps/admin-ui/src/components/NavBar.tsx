'use client';

import Link from 'next/link';
import { House, Users2, LucideBadgeInfo } from 'lucide-react';

import { useLanguage } from '@/components/useLanguage';

import styles from './NavBar.module.css';
import { i18n } from '@/i18n';

function translate(language: keyof typeof i18n, name: string ) {
    // @ts-expect-error no need to check
    return i18n[language][name];
}

export const NavBar = () => {
    const pages = [
        ['home', '', House],
        ['users', 'users', Users2],
        ['about', 'about', LucideBadgeInfo],
    ];
    const { language } = useLanguage();
    // the page name is in the current language via i18n mapping
    // list the pages with links to the correct language path
    return (
        <nav className={styles.NavBar}>
            {pages.map(([name, path, Icon]) => (
                <Link key={path as string} href={`/${language}/${path}`}>
                    <Icon color="#667eea" size={32} />
                    {translate(language, name as string)}
                </Link>
            ))}
        </nav>
    );
};
