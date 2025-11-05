'use client';

import Link from 'next/link';
import { House, Users2 , LucideBadgeInfo} from 'lucide-react';

import { useLanguage } from '@/components/useLanguage';

import styles from './NavBar.module.css';

export const NavBar = () => {
    const pages = [
        ['home', '', ()=><House color="#667eea" size={32} />],
        ['users', 'users', ()=><Users2 color="#667eea" size={32} />],
        ['about', 'about', ()=><LucideBadgeInfo color="#667eea" size={32} />],
    ];
    const { language } = useLanguage();
    // page name is in the current language via i18n mapping
    // list the pages with links to the correct language path
    return (
        <nav className={styles.NavBar}>
            {pages.map(([name, path, Icon]) => (
                <Link key={path} href={`/${language}/${path}`}>
                    <Icon/>
                    {name}
                </Link>
            ))}
        </nav>
    );
};
