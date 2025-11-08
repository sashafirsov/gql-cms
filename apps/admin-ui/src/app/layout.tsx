import type { ReactNode } from 'react';
import { Suspense } from 'react';

import './global.css';
import styles from './page.module.css';
import { Heading } from '@/components/Heading';
import { Loading } from '@/components/Loading';
import { NavBar } from '@/components/NavBar';
import { ApolloProvider } from '@/components/ApolloProvider';

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
        <ApolloProvider>
          <Suspense fallback={<Loading /> as ReactNode}>
            <Heading title="Welcome" />
          </Suspense>
          <Suspense fallback={<Loading /> as ReactNode}>
            <NavBar />
          </Suspense>
          <main>{children}</main>
        </ApolloProvider>
      </body>
    </html>
  );
}
