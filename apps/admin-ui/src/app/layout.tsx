'use client';

import './global.css';
import { Heading } from "@/compoents/heading";
import type { ReactNode } from "react";

import styles from './page.module.css';
import { useLanguage } from "@/compoents/useLanguage";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { getText } = useLanguage();
  return (
    <html lang="en">
      <body className={styles.page}>
        <Heading title={getText('welcome')} />
        {children}
      </body>
    </html>
  );
}
