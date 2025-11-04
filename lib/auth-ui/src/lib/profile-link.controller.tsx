// profile-link.controller.tsx
// Controller with business logic for profile/login link switcher

'use client';

import { useState, useEffect } from 'react';
import { LoginLink } from './login-link.component';
import { ProfileLink } from './profile-link.component';
import styles from './auth-links.module.css';

export interface ProfileLinkControllerProps {
    lang?: string;
    apiBaseUrl?: string;
    onAuthCheck?: (isAuthenticated: boolean) => void;
    className?: string;
    showAvatar?: boolean;
}

export interface UserInfo {
    id: string;
    email: string;
    displayName: string;
    kind: string;
    emailVerified: boolean;
}

/**
 * ProfileLinkController
 *
 * Checks authentication status and displays:
 * - ProfileLink if user is logged in
 * - LoginLink if user is not logged in
 */
export function ProfileLinkController({
    lang = 'en',
    apiBaseUrl = '/northwind/auth',
    onAuthCheck,
    className,
    showAvatar = true,
}: ProfileLinkControllerProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<UserInfo | null>(null);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        setIsLoading(true);

        try {
            // First check session storage for quick check
            if (typeof window !== 'undefined') {
                const userData = sessionStorage.getItem('user');
                if (userData) {
                    const parsedUser = JSON.parse(userData) as UserInfo;
                    setUser(parsedUser);
                    setIsAuthenticated(true);

                    if (onAuthCheck) {
                        onAuthCheck(true);
                    }

                    setIsLoading(false);
                    return;
                }
            }

            // If no session storage, check with API
            const response = await fetch(`${apiBaseUrl}/me`, {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.principal) {
                    setUser(data.principal);
                    setIsAuthenticated(true);

                    // Store in session storage
                    if (typeof window !== 'undefined') {
                        sessionStorage.setItem(
                            'user',
                            JSON.stringify(data.principal)
                        );
                    }

                    if (onAuthCheck) {
                        onAuthCheck(true);
                    }
                } else {
                    setIsAuthenticated(false);
                    if (onAuthCheck) {
                        onAuthCheck(false);
                    }
                }
            } else {
                setIsAuthenticated(false);
                if (onAuthCheck) {
                    onAuthCheck(false);
                }
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setIsAuthenticated(false);
            if (onAuthCheck) {
                onAuthCheck(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className={className || styles.authLinkContainer}>
                <span className={styles.loading} data-testid="auth-loading">
                    ...
                </span>
            </div>
        );
    }

    if (isAuthenticated && user) {
        return (
            <div className={className || styles.authLinkContainer}>
                <ProfileLink
                    lang={lang}
                    displayName={user.displayName}
                    showAvatar={showAvatar}
                />
            </div>
        );
    }

    return (
        <div className={className || styles.authLinkContainer}>
            <LoginLink lang={lang} />
        </div>
    );
}

export default ProfileLinkController;
