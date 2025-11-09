'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import styles from './page.module.css';

interface UserInfo {
  id: string;
  email: string;
  displayName: string;
}

interface ShortUrlData {
  fullUrl: string;
  shortUrl: string;
}

interface CreateDocumentMutationData {
  createDocument?: {
    document?: {
      id: string;
      fullUrl: string;
      shortUrl: string;
      comment?: string;
      createdAt: string;
    };
  };
}

interface CreateDocumentMutationVariables {
  fullUrl: string;
  shortUrl: string;
  comment?: string;
}

// GraphQL mutation to create a short URL
const CREATE_SHORT_URL = gql`
  mutation CreateDocument($fullUrl: String!, $shortUrl: String!, $comment: String) {
    createDocument(
      input: {
        document: {
          fullUrl: $fullUrl
          shortUrl: $shortUrl
          comment: $comment
        }
      }
    ) {
      document {
        id
        fullUrl
        shortUrl
        comment
        createdAt
      }
    }
  }
`;

// GraphQL query to fetch documents with pagination
const GET_DOCUMENTS = gql`
  query GetDocuments($first: Int!, $after: Cursor) {
    allDocuments(first: $first, after: $after, orderBy: CREATED_AT_DESC) {
      nodes {
        id
        fullUrl
        shortUrl
        comment
        createdAt
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

interface Document {
  id: string;
  fullUrl: string;
  shortUrl: string;
  comment?: string;
  createdAt: string;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

interface GetDocumentsData {
  allDocuments: {
    nodes: Document[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

/**
 * URL Shortener Page
 *
 * Allows authenticated users to create shortened URLs
 * Stores URLs in gql_cms.documents table
 */
export default function UrlShortenerPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [shortUrlData, setShortUrlData] = useState<ShortUrlData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pageSize] = useState(10);
  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);

  const [createShortUrl, { loading: mutationLoading }] = useMutation<
    CreateDocumentMutationData,
    CreateDocumentMutationVariables
  >(CREATE_SHORT_URL, {
    refetchQueries: [{ query: GET_DOCUMENTS, variables: { first: pageSize } }],
  });

  // Query to fetch documents with pagination
  const { data: documentsData, loading: documentsLoading } = useQuery<GetDocumentsData>(
    GET_DOCUMENTS,
    {
      variables: { first: pageSize, after: afterCursor },
      skip: !user, // Only query when user is authenticated
    }
  );

  // Check authentication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userData = sessionStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        // Not authenticated, redirect to login
        router.push('/en/auth/login');
      }
      setLoading(false);
    }
  }, [router]);

  // Generate a unique short URL slug
  const generateSlug = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let slug = '';
    for (let i = 0; i < 6; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  };

  // Validate URL
  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCopied(false);

    // Validate URL
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Please enter a valid URL (must start with http:// or https://)');
      return;
    }

    try {
      // Generate a unique slug
      const slug = generateSlug();
      const shortUrl = `${window.location.origin}/${slug}`;

      // Create the short URL in the database
      const result = await createShortUrl({
        variables: {
          fullUrl: url,
          shortUrl: slug,
          comment: `Created by ${user?.displayName || user?.email || 'user'}`,
        },
      });

      if (result.data?.createDocument?.document) {
        setShortUrlData({
          fullUrl: url,
          shortUrl,
        });
      }
    } catch (err) {
      console.error('Error creating short URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to create short URL. Please try again.');
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (shortUrlData?.shortUrl) {
      try {
        await navigator.clipboard.writeText(shortUrlData.shortUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Handle creating another URL
  const handleReset = () => {
    setUrl('');
    setShortUrlData(null);
    setError(null);
    setCopied(false);
  };

  // Handle next page
  const handleNextPage = () => {
    if (documentsData?.allDocuments.pageInfo.hasNextPage) {
      setAfterCursor(documentsData.allDocuments.pageInfo.endCursor);
    }
  };

  // Handle previous page (reset to first page for simplicity)
  const handlePreviousPage = () => {
    setAfterCursor(undefined);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Copy short URL to clipboard
  const copyShortUrl = async (shortUrl: string) => {
    try {
      const fullUrl = `${window.location.origin}/${shortUrl}`;
      await navigator.clipboard.writeText(fullUrl);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting...
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            URL Shortener
            <span className={styles.icon}>🔗</span>
          </h1>
        </div>

        {/* Form or Success State */}
        {!shortUrlData ? (
          <>
            <div className={styles.sectionLabel}>Form</div>
            <p className={styles.bodyText}>Enter the URL to shorten</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="url" className={styles.label}>
                  URL
                </label>
                <input
                  id="url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/..."
                  className={styles.input}
                  disabled={mutationLoading}
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={mutationLoading}
              >
                {mutationLoading ? 'Shortening...' : 'Shorten'}
              </button>

              {error && <div className={styles.error}>{error}</div>}
            </form>
          </>
        ) : (
          <>
            <div className={styles.sectionLabel}>Success</div>
            <p className={styles.bodyText}>Enter the URL to shorten</p>

            <form className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="url-display" className={styles.label}>
                  URL
                </label>
                <input
                  id="url-display"
                  type="text"
                  value={shortUrlData.fullUrl}
                  className={styles.input}
                  disabled
                />
              </div>

              <button
                type="button"
                className={`${styles.submitButton} ${styles.disabledButton}`}
                disabled
              >
                Shorten
              </button>

              <div className={styles.successMessage}>
                Success! Here&apos;s your short URL:
              </div>

              <div className={styles.shortUrlRow}>
                <a
                  href={shortUrlData.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.shortUrlLink}
                >
                  {shortUrlData.shortUrl}
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={styles.copyButton}
                >
                  📋 {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className={styles.resetButton}
              >
                Create Another
              </button>
            </form>
          </>
        )}
      </div>

      {/* URL List Section */}
      <div className={`${styles.card} ${styles.cardWide}`} style={{ marginTop: '2rem' }}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Your Shortened URLs
            <span className={styles.icon}>📋</span>
          </h2>
        </div>

        {documentsLoading ? (
          <div className={styles.loading}>Loading URLs...</div>
        ) : documentsData?.allDocuments.nodes.length === 0 ? (
          <div className={styles.bodyText} style={{ padding: '2rem', textAlign: 'center' }}>
            No URLs yet. Create your first shortened URL above!
          </div>
        ) : (
          <>
            <div className={styles.urlList}>
              {documentsData?.allDocuments.nodes.map((doc) => (
                <div key={doc.id} className={styles.urlItem}>
                  <div className={styles.urlItemHeader}>
                    <div className={styles.urlItemShort}>
                      <strong>Short:</strong>{' '}
                      <a
                        href={`${typeof window !== 'undefined' ? window.location.origin : ''}/${doc.shortUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.shortUrlLink}
                      >
                        /{doc.shortUrl}
                      </a>
                      <button
                        type="button"
                        onClick={() => copyShortUrl(doc.shortUrl)}
                        className={styles.copyButtonSmall}
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                    <div className={styles.urlItemDate}>
                      {formatDate(doc.createdAt)}
                    </div>
                  </div>
                  <div className={styles.urlItemFull}>
                    <strong>Full URL:</strong>{' '}
                    <a
                      href={doc.fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fullUrlLink}
                    >
                      {doc.fullUrl}
                    </a>
                  </div>
                  {doc.comment && (
                    <div className={styles.urlItemComment}>
                      <em>{doc.comment}</em>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className={styles.pagination}>
              <div className={styles.paginationInfo}>
                Showing {documentsData?.allDocuments.nodes.length || 0} of{' '}
                {documentsData?.allDocuments.totalCount || 0} URLs
              </div>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={!afterCursor}
                  className={styles.paginationButton}
                >
                  ← First Page
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!documentsData?.allDocuments.pageInfo.hasNextPage}
                  className={styles.paginationButton}
                >
                  Next Page →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
