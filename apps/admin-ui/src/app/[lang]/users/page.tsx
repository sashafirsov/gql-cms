'use client';

import { useState } from 'react';
import Link from 'next/link';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import styles from './page.module.css';

// GraphQL query to fetch users with pagination
const GET_USERS = gql`
  query GetUsers($first: Int!, $after: Cursor) {
    allUsers(first: $first, after: $after, orderBy: CREATED_AT_DESC) {
      nodes {
        id
        email
        fullName
        authProvider
        emailVerified
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

interface User {
  id: string;
  email: string;
  fullName: string;
  authProvider: string;
  emailVerified?: boolean;
  createdAt: string;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

interface GetUsersData {
  allUsers: {
    nodes: User[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

interface GetUsersVariables {
  first: number;
  after?: string;
}

export default function UsersPage() {
  const [pageSize] = useState(10);
  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);

  const { loading, error, data } = useQuery<GetUsersData, GetUsersVariables>(
    GET_USERS,
    {
      variables: {
        first: pageSize,
        after: afterCursor,
      },
    }
  );

  const handleNextPage = () => {
    if (data?.allUsers.pageInfo.endCursor) {
      setAfterCursor(data.allUsers.pageInfo.endCursor);
    }
  };

  const handlePreviousPage = () => {
    setAfterCursor(undefined);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Users Management</h1>
        <p className={styles.subtitle}>Manage and view all users in the system</p>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading users...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>Error loading users: {error.message}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{data.allUsers.totalCount}</div>
              <div className={styles.statLabel}>Total Users</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{data.allUsers.nodes.length}</div>
              <div className={styles.statLabel}>On This Page</div>
            </div>
          </div>

          {data.allUsers.nodes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <h2>No Users Found</h2>
              <p>There are no users in the system yet.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Full Name</th>
                      <th>Auth Provider</th>
                      <th>Email Verified</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.allUsers.nodes.map((user) => (
                      <tr key={user.id} className={styles.row}>
                        <td className={styles.email}>{user.email}</td>
                        <td>{user.fullName}</td>
                        <td>
                          <span className={styles.badge}>{user.authProvider}</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.status} ${
                              user.emailVerified ? styles.verified : styles.unverified
                            }`}
                          >
                            {user.emailVerified ? '✓ Verified' : '✗ Not Verified'}
                          </span>
                        </td>
                        <td className={styles.date}>{formatDate(user.createdAt)}</td>
                        <td>
                          <Link
                            href={`/en/users/${user.id}`}
                            className={styles.viewButton}
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <button
                  onClick={handlePreviousPage}
                  disabled={!afterCursor}
                  className={styles.paginationButton}
                >
                  ← Previous
                </button>
                <span className={styles.paginationInfo}>
                  Showing {data.allUsers.nodes.length} of {data.allUsers.totalCount} users
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={!data.allUsers.pageInfo.hasNextPage}
                  className={styles.paginationButton}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
