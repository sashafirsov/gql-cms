import type { ReactNode } from 'react';
import { Suspense } from 'react';

import './global.css';
import styles from './page.module.css';
import { Heading } from '@/components/Heading';
import { Loading } from '@/components/Loading';
import { NavBar } from '@/components/NavBar';

export const metadata = {
  title: 'GraphQL CMS',
  description: 'GraphQL CMS Admin UI',
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={styles.page}>
        <Suspense fallback={<Loading /> as ReactNode}>
          <Heading title="Welcome" />
        </Suspense>
        <Suspense fallback={<Loading /> as ReactNode}>
          <NavBar />
        </Suspense>
        <main>{children}</main>
      </body>
    </html>
  );
}
