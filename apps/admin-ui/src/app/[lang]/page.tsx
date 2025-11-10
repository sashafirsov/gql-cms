'use client';

import { useEffect, useState } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { i18n } from '../../i18n';
import HomePage from '../page';
import styles from './slug-redirect.module.css';

interface PageProps {
  params: Promise<{ lang: string }>;
}

interface DocumentNode {
  id: string;
  fullUrl: string;
  shortUrl: string;
}

interface GetDocumentData {
  allDocuments: {
    nodes: DocumentNode[];
  };
}

const GET_DOCUMENT_BY_SHORT_URL = gql`
  query GetDocumentByShortUrl($shortUrl: String!) {
    allDocuments(condition: { shortUrl: $shortUrl }, first: 1) {
      nodes {
        id
        fullUrl
        shortUrl
      }
    }
  }
`;

const CREATE_SLUG_TRACKING = gql`
  mutation CreateSlug($slug: String!, $url: String!, $userAgent: String, $documentId: UUID!) {
    createSlug(
      input: {
        slug: { slug: $slug, url: $url, userAgent: $userAgent, documentId: $documentId }
      }
    ) {
      slug {
        id
      }
    }
  }
`;

export default function LangOrSlugPage({ params }: PageProps) {
  const [isValidLang, setIsValidLang] = useState<boolean | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [getDocument] = useLazyQuery<GetDocumentData>(GET_DOCUMENT_BY_SHORT_URL);
  const [createSlugTracking] = useMutation(CREATE_SLUG_TRACKING);

  useEffect(() => {
    // Resolve params Promise
    params.then(({ lang: langParam }) => {
      // Check if lang is a valid language key
      const validLang = langParam in i18n;
      setIsValidLang(validLang);

      // If not a valid language, treat as slug
      if (!validLang) {
        handleSlugRedirect(langParam);
      }
    });
  }, [params]);

  const handleSlugRedirect = async (slug: string) => {
    try {
      setRedirecting(true);

      // Query for the document
      const { data } = await getDocument({
        variables: { shortUrl: slug },
      });

      // Check if document exists
      if (!data || !data.allDocuments || data.allDocuments.nodes.length === 0) {
        setNotFound(true);
        setRedirecting(false);
        return;
      }

      const document = data.allDocuments.nodes[0];

      // Track the slug access
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      try {
        await createSlugTracking({
          variables: {
            slug: slug,
            url: document.fullUrl,
            userAgent: userAgent,
            documentId: document.id,
          },
        });
      } catch (trackingError) {
        // Log but don't fail the redirect if tracking fails
        console.error('Failed to track slug access:', trackingError);
      }

      // Client-side redirect to the full URL
      window.location.href = document.fullUrl;
    } catch (error) {
      console.error('Error handling slug redirect:', error);
      setNotFound(true);
      setRedirecting(false);
    }
  };

  // Show loading while checking
  if (isValidLang === null || redirecting) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner}></div>
          <p className={styles.message}>
            {redirecting ? 'Redirecting...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Show 404 for invalid slugs
  if (notFound) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.iconContainer}>
            <span className={styles.icon}>🔍</span>
          </div>
          <h1 className={styles.title}>404 - URL Not Found</h1>
          <p className={styles.message}>
            The shortened URL you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <div className={styles.actions}>
            <a href="/" className={styles.primaryButton}>
              Go to Home
            </a>
            <a href="/en/urls" className={styles.secondaryButton}>
              Create Short URL
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render the home page for valid languages
  if (isValidLang) {
    return <HomePage />;
  }

  return null;
}
