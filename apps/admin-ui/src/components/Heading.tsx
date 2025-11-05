import { Suspense } from 'react';

import LanguageSelector from '@/components/LanguageSelector';
import styles from './Heading.module.css';
import { ProfileLinkController } from '@auth-ui';

export const Heading = ({ title }: { title: string }) => (
    <header className={styles.heading}>
        <h1>{title}</h1>

        <Suspense>
            <LanguageSelector></LanguageSelector>
            <ProfileLinkController />
        </Suspense>
    </header>
);
