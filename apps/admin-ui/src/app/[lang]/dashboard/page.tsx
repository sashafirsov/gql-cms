'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

interface UserInfo {
    id: string;
    email: string;
    kind: string;
    displayName: string;
    emailVerified: boolean;
}

/**
 * Dashboard Page
 *
 * Protected page that requires authentication
 * Shows user information and navigation
 */
export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated
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

    const handleLogout = async () => {
        try {
            await fetch('/northwind/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            // Clear session and redirect
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('user');
            }
            // @ts-expect-error for now
            window.location = '/en/auth/login';
        }
    };

    if (loading) {
        return (
            <div className={styles.dashboard}>
                <div className={styles.loading}>Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null; // Redirecting...
    }

    return (
        <div className={styles.dashboard}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className={styles.logoutButton}
                    >
                        Sign Out
                    </button>
                </header>

                <div className={styles.welcomeCard}>
                    <h2 className={styles.welcomeTitle}>
                        Welcome back, {user.displayName}!
                    </h2>
                    <p className={styles.welcomeText}>
                        You are successfully logged in.
                    </p>
                </div>

                <div className={styles.userInfoCard}>
                    <h3 className={styles.cardTitle}>Your Profile</h3>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Email:</span>
                            <span className={styles.infoValue}>
                                {user.email}
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>User ID:</span>
                            <span className={styles.infoValue}>{user.id}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>
                                Account Type:
                            </span>
                            <span className={styles.infoValue}>
                                {user.kind.charAt(0).toUpperCase() +
                                    user.kind.slice(1)}
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>
                                Email Verified:
                            </span>
                            <span className={styles.infoValue}>
                                {user.emailVerified ? '✓ Yes' : '✗ No'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={styles.navigationCard}>
                    <h3 className={styles.cardTitle}>Quick Links</h3>
                    <nav className={styles.navGrid}>
                        <a href="/en/users" className={styles.navLink}>
                            <span className={styles.navIcon}>👥</span>
                            <span>Users</span>
                        </a>
                        <a href="/en/urls" className={styles.navLink}>
                            <span className={styles.navIcon}>🔗</span>
                            <span>URLs</span>
                        </a>
                        <a href="/en/about" className={styles.navLink}>
                            <span className={styles.navIcon}>ℹ️</span>
                            <span>About</span>
                        </a>
                    </nav>
                </div>
            </div>
        </div>
    );
}
