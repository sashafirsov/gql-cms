// login-link.component.tsx
// Pure functional React component for login link

'use client';

import styles from './auth-links.module.css';

export interface LoginLinkProps {
  lang?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * LoginLink Component
 *
 * A link to the login page
 * Supports internationalization via lang parameter
 */
export function LoginLink({
  lang = 'en',
  className,
  children,
  onClick,
}: LoginLinkProps) {
  const href = `/${lang}/auth/login`;

  return (
    <a
      href={href}
      className={className || styles.loginLink}
      onClick={onClick}
      data-testid="login-link"
    >
      {children || 'Sign In'}
    </a>
  );
}

export default LoginLink;
