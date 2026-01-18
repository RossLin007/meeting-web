// 智会 - 共享布局组件

import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetingStore } from '@/services/store';
import { UserSettingsModal } from '@/components/user/UserSettingsModal';
import { Button, Modal } from '@/components/common';
import {
    HomeIcon, CalendarIcon, UsersIcon, SettingsIcon, VideoIcon,
    LogoutIcon, FilmIcon
} from '@/components/icons';
import { useState, useEffect } from 'react';
import styles from './Layout.module.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface LayoutProps {
    children: ReactNode;
    title?: string;
}

export function Layout({ children, title }: LayoutProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoggedIn, logout, isLoading: authLoading } = useAuth();
    const { currentUser, setCurrentUser } = useMeetingStore();

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showUserSettings, setShowUserSettings] = useState(false);

    // 获取当前激活的导航项
    const getActiveNav = () => {
        const path = location.pathname;
        if (path === '/') return 'home';
        if (path === '/meetings') return 'meetings';
        if (path === '/storage') return 'storage';
        if (path === '/contacts') return 'contacts';
        return 'home';
    };

    const activeNav = getActiveNav();

    // 同步 SSO 用户到 useMeetingStore
    useEffect(() => {
        if (isLoggedIn && user) {
            fetch(`${API_BASE_URL}/api/usersig/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setCurrentUser({
                            userId: user.id,
                            userName: user.username,
                            userSig: data.data.userSig,
                        });
                    }
                })
                .catch((err) => console.error('生成 UserSig 失败:', err));
        }
    }, [isLoggedIn, user, setCurrentUser]);

    // 确认退出登录
    const handleLogout = async () => {
        setIsLoggingOut(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        await logout();
        setIsLoggingOut(false);
        setShowLogoutModal(false);
    };

    // 获取页面标题
    const getPageTitle = () => {
        if (title) return title;
        switch (activeNav) {
            case 'home': return t('home.dashboard');
            case 'meetings': return t('home.meetings');
            case 'storage': return t('home.myRecordings');
            case 'contacts': return t('home.contacts');
            default: return t('home.dashboard');
        }
    };

    if (authLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>{t('common.loading')}</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* 左侧边栏 */}
            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    <VideoIcon />
                    <span>{t('home.appName')}</span>
                </div>

                <nav className={styles.nav}>
                    <button
                        className={`${styles.navItem} ${activeNav === 'home' ? styles.active : ''}`}
                        onClick={() => navigate('/')}
                    >
                        <HomeIcon />
                        <span>{t('home.dashboard')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'meetings' ? styles.active : ''}`}
                        onClick={() => navigate('/meetings')}
                    >
                        <CalendarIcon />
                        <span>{t('home.meetings')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'storage' ? styles.active : ''}`}
                        onClick={() => navigate('/storage')}
                    >
                        <FilmIcon />
                        <span>{t('home.myRecordings')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'contacts' ? styles.active : ''}`}
                        onClick={() => navigate('/contacts')}
                    >
                        <UsersIcon />
                        <span>{t('home.contacts')}</span>
                    </button>
                </nav>

                {/* 用户信息 */}
                <div className={styles.userSection}>
                    {isLoggedIn && user && (
                        <div
                            className={styles.userCard}
                            onClick={() => setShowUserSettings(true)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.userAvatar}>
                                {user.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className={styles.userInfo}>
                                <span className={styles.userName}>{user.username}</span>
                                <span className={styles.userStatus}>{t('home.online')}</span>
                            </div>
                            <div className={styles.userActions}>
                                <button
                                    className={styles.settingsBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowUserSettings(true);
                                    }}
                                    title={t('home.settings')}
                                >
                                    <SettingsIcon />
                                </button>
                                <button
                                    className={styles.logoutBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowLogoutModal(true);
                                    }}
                                    title={t('home.logout')}
                                >
                                    <LogoutIcon />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* 主内容区 */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <h1 className={styles.pageTitle}>{getPageTitle()}</h1>
                </header>

                <div className={styles.content}>
                    {children}
                </div>
            </main>

            {/* 退出确认弹窗 */}
            <Modal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                title={t('home.confirmLogout')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="danger" onClick={handleLogout} loading={isLoggingOut}>
                            {isLoggingOut ? t('home.loggingOut') : t('home.logout')}
                        </Button>
                    </>
                }
            >
                <p>{t('home.logoutConfirmMessage')}</p>
            </Modal>

            {/* 用户设置弹窗 */}
            {showUserSettings && (
                <UserSettingsModal
                    isOpen={showUserSettings}
                    onClose={() => setShowUserSettings(false)}
                />
            )}
        </div>
    );
}

export default Layout;
