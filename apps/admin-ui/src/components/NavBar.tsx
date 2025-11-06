'use client';

import Link from 'next/link';
import { House, Users2, LucideBadgeInfo } from 'lucide-react';

import { useLanguage } from '@/components/useLanguage';

import styles from './NavBar.module.css';
import { i18n } from '@/i18n';

export const NavBar = () => {
    const pages = [
        ['home', '', House],
        ['users', 'users', Users2],
        ['about', 'about', LucideBadgeInfo],
        // ['home', '', ()=><House color="#667eea" size={32} />],
        // ['users', 'users', ()=><Users2 color="#667eea" size={32} />],
        // ['about', 'about', ()=><LucideBadgeInfo color="#667eea" size={32} />],
    ];
    const { language } = useLanguage();
    // the page name is in the current language via i18n mapping
    // list the pages with links to the correct language path
    return (
        <nav className={styles.NavBar}>
            {pages.map(([name, path, Icon]) => (
                <Link key={path as string} href={`/${language}/${path}`}>
                    <Icon color="#667eea" size={32} />
                    {i18n[language][name] as string}
                </Link>
            ))}
        </nav>
    );
};
