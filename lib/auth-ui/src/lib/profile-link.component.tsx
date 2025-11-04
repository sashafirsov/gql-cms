// profile-link.component.tsx
// Pure functional React component for profile link

'use client';

import styles from './auth-links.module.css';

export interface ProfileLinkProps {
  lang?: string;
  className?: string;
  children?: React.ReactNode;
  displayName?: string;
  showAvatar?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * ProfileLink Component
 *
 * A link to the user's profile page
 * Shows user's display name and optional avatar
 */
export function ProfileLink({
  lang = 'en',
  className,
  children,
  displayName,
  showAvatar = true,
  onClick,
}: ProfileLinkProps) {
  const href = `/${lang}/profile`;

  // Get initials from display name
  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <a
      href={href}
      className={className || styles.profileLink}
      onClick={onClick}
      data-testid="profile-link"
    >
      {showAvatar && (
        <span className={styles.avatar} data-testid="profile-avatar">
          {getInitials(displayName)}
        </span>
      )}
      <span className={styles.profileName} data-testid="profile-name">
        {children || displayName || 'Profile'}
      </span>
    </a>
  );
}

export default ProfileLink;
