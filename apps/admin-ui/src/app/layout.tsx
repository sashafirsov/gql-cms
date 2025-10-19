'use client';

import './global.css';
import { Heading } from '@/components/Heading';
import type { ReactNode } from 'react';

import styles from './page.module.css';
import { useLanguage } from '@/components/useLanguage';
import { Loading } from '@/components/Loading';
import { Suspense } from 'react';

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
    {children}
    </body>
    </html>
  );
}
