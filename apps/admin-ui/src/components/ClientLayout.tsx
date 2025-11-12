'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Heading } from '@/components/Heading';
import { useLanguage } from '@/components/useLanguage';
import { Loading } from '@/components/Loading';
import { NavBar } from '@/components/NavBar';
import { ApolloProvider } from '@/components/ApolloProvider';

const HeadingWithLang = () => {
    const { getText } = useLanguage();
    return <Heading title={getText('welcome')} />;
};

export function ClientLayout({ children }: { children: ReactNode }) {
    return (
        <ApolloProvider>
            <Suspense fallback={(<Loading />) as ReactNode}>
                <HeadingWithLang />
            </Suspense>
            <Suspense fallback={(<Loading />) as ReactNode}>
                <NavBar />
            </Suspense>
            <main>{children}</main>
        </ApolloProvider>
    );
}
