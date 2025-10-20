'use client';

import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Loading } from '@/components/Loading';

export default function UrlsLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading /> as ReactNode}>{children}</Suspense>;
}
