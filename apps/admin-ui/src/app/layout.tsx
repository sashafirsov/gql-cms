import type { ReactNode } from 'react';
import './global.css';
import styles from './page.module.css';
import { ClientLayout } from '@/components/ClientLayout';

export const metadata = {
    title: 'GraphQL CMS',
    description: 'GraphQL CMS Admin UI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className={styles.page}>
                <ClientLayout>{children}</ClientLayout>
            </body>
        </html>
    );
}
