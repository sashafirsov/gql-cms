'use client';

import type { ReactNode } from 'react';
import styles from './auth-layout.module.css';

/**
 * Auth Layout
 *
 * Simple, centered layout for authentication pages
 * No navigation or headers - just the auth content
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.authLayout}>
      <div className={styles.authContainer}>
        {children}
      </div>
    </div>
  );
}
