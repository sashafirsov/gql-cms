'use client';

import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import styles from './page.module.css';

const GET_USER_DETAILS = gql`
  query GetUserDetails($userId: UUID!) {
    userById(id: $userId) {
      id
      email
      fullName
      authProvider
      emailVerified
      createdAt
      updatedAt
      userRolesByUserId {
        nodes {
          roleName
        }
      }
      oauthIdentitiesByUserId {
        nodes {
          id
          provider
          providerEmail
          createdAt
        }
      }
      documentAclsByUserId {
        nodes {
          roleName
          documentByDocumentId {
            id
            fullUrl
            shortUrl
            comment
            createdAt
          }
        }
      }
      sessionsByUserId(orderBy: LAST_ACTIVE_AT_DESC, first: 5) {
        nodes {
          id
          createdAt
          lastActiveAt
          expiresAt
          userAgent
          ipAddress
        }
      }
    }
  }
`;

interface PageProps {
  params: Promise<{
    lang: string;
    userid: string;
  }>;
}

interface UserRole {
  roleName: string;
}

interface OAuthIdentity {
  id: string;
  provider: string;
  providerEmail: string;
  createdAt: string;
}

interface Document {
  id: string;
  fullUrl: string;
  shortUrl: string;
  comment?: string;
  createdAt: string;
}

interface DocumentAcl {
  roleName: string;
  documentByDocumentId: Document;
}

interface Session {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
}

interface UserDetails {
  id: string;
  email: string;
  fullName: string;
  authProvider: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  userRolesByUserId: {
    nodes: UserRole[];
  };
  oauthIdentitiesByUserId: {
    nodes: OAuthIdentity[];
  };
  documentAclsByUserId: {
    nodes: DocumentAcl[];
  };
  sessionsByUserId: {
    nodes: Session[];
  };
}

interface GetUserDetailsData {
  userById: UserDetails | null;
}

interface GetUserDetailsVariables {
  userId: string;
}

export default function UserDetailPage({ params }: PageProps) {
  // const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    params.then(({ userid }) => {
      setUserId(userid);
    });
  }, [params]);

  const { loading, error, data } = useQuery<GetUserDetailsData, GetUserDetailsVariables>(
    GET_USER_DETAILS,
    {
      variables: { userId },
      skip: !userId,
    }
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const isSessionActive = (expiresAt: string) => {
    return new Date(expiresAt) > new Date();
  };

  if (!userId) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading User</h2>
          <p>{error.message}</p>
          <Link href="/en/users" className={styles.backButton}>
            ← Back to Users
          </Link>
        </div>
      </div>
    );
  }

  if (!data?.userById) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <div className={styles.notFoundIcon}>🔍</div>
          <h2>User Not Found</h2>
          <p>The user with ID {userId} does not exist.</p>
          <Link href="/en/users" className={styles.backButton}>
            ← Back to Users
          </Link>
        </div>
      </div>
    );
  }

  const user = data.userById;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/en/users" className={styles.backLink}>
          ← Back to Users
        </Link>
        <h1 className={styles.title}>{user.fullName}</h1>
        <p className={styles.subtitle}>{user.email}</p>
      </div>

      <div className={styles.grid}>
        {/* Basic Information Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Basic Information</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user.email}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Full Name</span>
              <span className={styles.infoValue}>{user.fullName}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Auth Provider</span>
              <span className={styles.badge}>{user.authProvider}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email Verified</span>
              <span
                className={`${styles.status} ${
                  user.emailVerified ? styles.verified : styles.unverified
                }`}
              >
                {user.emailVerified ? '✓ Verified' : '✗ Not Verified'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Created</span>
              <span className={styles.infoValue}>
                {formatDate(user.createdAt)}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Last Updated</span>
              <span className={styles.infoValue}>
                {formatRelativeTime(user.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Global Roles Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Global Roles</h2>
          {user.userRolesByUserId.nodes.length === 0 ? (
            <p className={styles.emptyMessage}>No global roles assigned</p>
          ) : (
            <div className={styles.roleList}>
              {user.userRolesByUserId.nodes.map((role, index) => (
                <span key={index} className={styles.roleBadge}>
                  {role.roleName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* OAuth Identities Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>OAuth Providers</h2>
          {user.oauthIdentitiesByUserId.nodes.length === 0 ? (
            <p className={styles.emptyMessage}>No OAuth providers linked</p>
          ) : (
            <div className={styles.oauthList}>
              {user.oauthIdentitiesByUserId.nodes.map((identity) => (
                <div key={identity.id} className={styles.oauthItem}>
                  <span className={styles.oauthProvider}>{identity.provider}</span>
                  <span className={styles.oauthEmail}>
                    {identity.providerEmail}
                  </span>
                  <span className={styles.oauthDate}>
                    Linked {formatRelativeTime(identity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Sessions Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Recent Sessions</h2>
          {user.sessionsByUserId.nodes.length === 0 ? (
            <p className={styles.emptyMessage}>No active sessions</p>
          ) : (
            <div className={styles.sessionList}>
              {user.sessionsByUserId.nodes.map((session) => (
                <div key={session.id} className={styles.sessionItem}>
                  <div className={styles.sessionHeader}>
                    <span
                      className={`${styles.sessionStatus} ${
                        isSessionActive(session.expiresAt)
                          ? styles.sessionActive
                          : styles.sessionExpired
                      }`}
                    >
                      {isSessionActive(session.expiresAt) ? '● Active' : '○ Expired'}
                    </span>
                    <span className={styles.sessionTime}>
                      {formatRelativeTime(session.lastActiveAt)}
                    </span>
                  </div>
                  {session.userAgent && (
                    <div className={styles.sessionAgent}>{session.userAgent}</div>
                  )}
                  {session.ipAddress && (
                    <div className={styles.sessionIp}>IP: {session.ipAddress}</div>
                  )}
                  <div className={styles.sessionFooter}>
                    <span>Created: {formatDate(session.createdAt)}</span>
                    <span>Expires: {formatDate(session.expiresAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents Access Card */}
        <div className={styles.cardFull}>
          <h2 className={styles.cardTitle}>Document Access</h2>
          {user.documentAclsByUserId.nodes.length === 0 ? (
            <p className={styles.emptyMessage}>No document access granted</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Short URL</th>
                    <th>Full URL</th>
                    <th>Role</th>
                    <th>Comment</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {user.documentAclsByUserId.nodes.map((acl, index) => (
                    <tr key={index}>
                      <td>
                        <Link
                          href={`/${acl.documentByDocumentId.shortUrl}`}
                          className={styles.shortUrl}
                          target="_blank"
                        >
                          {acl.documentByDocumentId.shortUrl}
                        </Link>
                      </td>
                      <td className={styles.fullUrl}>
                        {acl.documentByDocumentId.fullUrl}
                      </td>
                      <td>
                        <span className={styles.roleBadge}>{acl.roleName}</span>
                      </td>
                      <td className={styles.comment}>
                        {acl.documentByDocumentId.comment || '-'}
                      </td>
                      <td className={styles.date}>
                        {formatDate(acl.documentByDocumentId.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
