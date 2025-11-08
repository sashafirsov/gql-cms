'use client';

import { ApolloProvider as ApolloClientProvider } from '@apollo/client/react';
import { gqlClient } from '../dal/ApolloClient';
import type { ReactNode } from 'react';

interface ApolloProviderProps {
  children: ReactNode;
}

/**
 * Apollo Provider Component
 *
 * Wraps the application with Apollo Client for GraphQL queries and mutations
 */
export function ApolloProvider({ children }: ApolloProviderProps) {
  return <ApolloClientProvider client={gqlClient}>{children}</ApolloClientProvider>;
}
