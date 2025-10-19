'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';

import './global.css';
import styles from './page.module.css';
import { Heading } from '@/components/Heading';
import { useLanguage } from '@/components/useLanguage';
import { Loading } from '@/components/Loading';
import { NavBar } from '@/components/NavBar';

const HeadingWithLang = () => {
  const { getText } = useLanguage();
  return <Heading title={getText('welcome')} />;
};

const RenderHeading = () => {
  return (
    <Suspense fallback={<Loading /> as ReactNode}>
      <HeadingWithLang />
    </Suspense>
  );
};

export default function RootLayout({
                                     children
                                   }: {
  children: ReactNode;
}) {
  return (
    <html>
    <body className={styles.page}>
    <RenderHeading/>
    <Suspense fallback={<Loading /> as ReactNode}>
      <NavBar/>
    </Suspense>
    <main>{children}</main>
    </body>
    </html>
  );
}
