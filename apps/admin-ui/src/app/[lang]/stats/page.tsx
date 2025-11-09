'use client';

import { useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import styles from './page.module.css';

// GraphQL query to fetch slug analytics with pagination
// Note: PostGraphile filtering may be limited without custom plugins
// For now, we'll fetch all data and filter client-side
const GET_SLUG_ANALYTICS = gql`
  query GetSlugAnalytics($first: Int!, $after: Cursor) {
    allSlugs(first: $first, after: $after, orderBy: CREATED_AT_DESC) {
      nodes {
        id
        slug
        url
        userAgent
        documentId
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

interface SlugAnalytic {
  id: string;
  slug: string;
  url: string;
  userAgent?: string;
  documentId: string;
  createdAt: string;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

interface GetSlugAnalyticsData {
  allSlugs: {
    nodes: SlugAnalytic[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

interface GetSlugAnalyticsVariables {
  first: number;
  after?: string;
}

export default function StatsPage() {
  const [pageSize] = useState(20);
  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);

  // Filter states
  const [slugFilter, setSlugFilter] = useState('');
  const [urlFilter, setUrlFilter] = useState('');
  const [userAgentFilter, setUserAgentFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    slug: '',
    url: '',
    userAgent: '',
    startDate: '',
    endDate: '',
  });

  const { loading, error, data } = useQuery<
    GetSlugAnalyticsData,
    GetSlugAnalyticsVariables
  >(GET_SLUG_ANALYTICS, {
    variables: {
      first: pageSize,
      after: afterCursor,
    },
  });

  // Client-side filtering
  const filteredData = data?.allSlugs.nodes.filter((item) => {
    const matchesSlug = !appliedFilters.slug ||
      item.slug.toLowerCase().includes(appliedFilters.slug.toLowerCase());
    const matchesUrl = !appliedFilters.url ||
      item.url.toLowerCase().includes(appliedFilters.url.toLowerCase());
    const matchesUserAgent = !appliedFilters.userAgent ||
      (item.userAgent && item.userAgent.toLowerCase().includes(appliedFilters.userAgent.toLowerCase()));

    const itemDate = new Date(item.createdAt);
    const matchesStartDate = !appliedFilters.startDate ||
      itemDate >= new Date(appliedFilters.startDate);
    const matchesEndDate = !appliedFilters.endDate ||
      itemDate <= new Date(appliedFilters.endDate);

    return matchesSlug && matchesUrl && matchesUserAgent && matchesStartDate && matchesEndDate;
  }) || [];

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      slug: slugFilter,
      url: urlFilter,
      userAgent: userAgentFilter,
      startDate: startDateFilter,
      endDate: endDateFilter,
    });
    setAfterCursor(undefined); // Reset to first page
  };

  const handleClearFilters = () => {
    setSlugFilter('');
    setUrlFilter('');
    setUserAgentFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setAppliedFilters({
      slug: '',
      url: '',
      userAgent: '',
      startDate: '',
      endDate: '',
    });
    setAfterCursor(undefined);
  };

  const handleNextPage = () => {
    if (data?.allSlugs.pageInfo.endCursor) {
      setAfterCursor(data.allSlugs.pageInfo.endCursor);
    }
  };

  const handlePreviousPage = () => {
    setAfterCursor(undefined);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Calculate stats from filtered data
  const uniqueSlugs = filteredData ? new Set(filteredData.map((s) => s.slug)).size : 0;
  const uniqueUrls = filteredData ? new Set(filteredData.map((s) => s.url)).size : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📊 URL Access Analytics</h1>
        <p className={styles.subtitle}>
          Track and analyze shortened URL access patterns
        </p>
      </div>

      {/* Filters Section */}
      <div className={styles.filtersCard}>
        <h2 className={styles.filtersTitle}>🔍 Filters</h2>
        <form onSubmit={handleApplyFilters} className={styles.filtersForm}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterGroup}>
              <label htmlFor="slug" className={styles.filterLabel}>
                Short Slug
              </label>
              <input
                id="slug"
                type="text"
                value={slugFilter}
                onChange={(e) => setSlugFilter(e.target.value)}
                placeholder="e.g., abc123"
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="url" className={styles.filterLabel}>
                Full URL
              </label>
              <input
                id="url"
                type="text"
                value={urlFilter}
                onChange={(e) => setUrlFilter(e.target.value)}
                placeholder="e.g., example.com"
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="userAgent" className={styles.filterLabel}>
                User Agent
              </label>
              <input
                id="userAgent"
                type="text"
                value={userAgentFilter}
                onChange={(e) => setUserAgentFilter(e.target.value)}
                placeholder="e.g., Chrome, Firefox"
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="startDate" className={styles.filterLabel}>
                Start Date
              </label>
              <input
                id="startDate"
                type="datetime-local"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="endDate" className={styles.filterLabel}>
                End Date
              </label>
              <input
                id="endDate"
                type="datetime-local"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className={styles.filterInput}
              />
            </div>
          </div>

          <div className={styles.filtersActions}>
            <button type="submit" className={styles.applyButton}>
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className={styles.clearButton}
            >
              Clear All
            </button>
          </div>
        </form>

        {/* Active Filters Display */}
        {(appliedFilters.slug ||
          appliedFilters.url ||
          appliedFilters.userAgent ||
          appliedFilters.startDate ||
          appliedFilters.endDate) && (
          <div className={styles.activeFilters}>
            <span className={styles.activeFiltersLabel}>Active Filters:</span>
            {appliedFilters.slug && (
              <span className={styles.filterTag}>
                Slug: {appliedFilters.slug}
              </span>
            )}
            {appliedFilters.url && (
              <span className={styles.filterTag}>URL: {appliedFilters.url}</span>
            )}
            {appliedFilters.userAgent && (
              <span className={styles.filterTag}>
                User Agent: {appliedFilters.userAgent}
              </span>
            )}
            {appliedFilters.startDate && (
              <span className={styles.filterTag}>
                From: {new Date(appliedFilters.startDate).toLocaleDateString()}
              </span>
            )}
            {appliedFilters.endDate && (
              <span className={styles.filterTag}>
                To: {new Date(appliedFilters.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Section */}
      {!loading && !error && data && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{filteredData.length}</div>
            <div className={styles.statLabel}>
              {appliedFilters.slug || appliedFilters.url || appliedFilters.userAgent ||
               appliedFilters.startDate || appliedFilters.endDate
                ? 'Filtered Results'
                : 'Total Accesses'}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{uniqueSlugs}</div>
            <div className={styles.statLabel}>Unique Slugs</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{uniqueUrls}</div>
            <div className={styles.statLabel}>Unique URLs</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{data.allSlugs.totalCount}</div>
            <div className={styles.statLabel}>Total in DB</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading analytics...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.error}>
          <p>Error loading analytics: {error.message}</p>
        </div>
      )}

      {/* Data Table */}
      {!loading && !error && data && (
        <>
          {filteredData.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h2>No Analytics Data</h2>
              <p>
                {appliedFilters.slug ||
                appliedFilters.url ||
                appliedFilters.userAgent ||
                appliedFilters.startDate ||
                appliedFilters.endDate
                  ? 'No data matches your filters. Try adjusting them.'
                  : 'No URL accesses have been tracked yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Slug</th>
                      <th>Full URL</th>
                      <th>User Agent</th>
                      <th>Accessed At</th>
                      <th>Document ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((analytic) => (
                      <tr key={analytic.id} className={styles.row}>
                        <td className={styles.slug}>
                          <code>{analytic.slug}</code>
                        </td>
                        <td className={styles.url}>
                          <a
                            href={analytic.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={analytic.url}
                          >
                            {truncateText(analytic.url, 50)}
                          </a>
                        </td>
                        <td className={styles.userAgent}>
                          <span title={analytic.userAgent || 'N/A'}>
                            {analytic.userAgent
                              ? truncateText(analytic.userAgent, 40)
                              : 'N/A'}
                          </span>
                        </td>
                        <td className={styles.date}>
                          {formatDate(analytic.createdAt)}
                        </td>
                        <td className={styles.documentId}>
                          <code>{truncateText(analytic.documentId, 12)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={styles.pagination}>
                <button
                  onClick={handlePreviousPage}
                  disabled={!afterCursor}
                  className={styles.paginationButton}
                >
                  ← First Page
                </button>
                <span className={styles.paginationInfo}>
                  Showing {filteredData.length} of {data.allSlugs.totalCount} accesses
                  {(appliedFilters.slug || appliedFilters.url || appliedFilters.userAgent ||
                    appliedFilters.startDate || appliedFilters.endDate) && ' (filtered)'}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={!data.allSlugs.pageInfo.hasNextPage}
                  className={styles.paginationButton}
                >
                  Next Page →
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
