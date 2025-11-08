'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
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

  const [createShortUrl, { loading: mutationLoading }] = useMutation<
    CreateDocumentMutationData,
    CreateDocumentMutationVariables
  >(CREATE_SHORT_URL);

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
    </div>
  );
}
