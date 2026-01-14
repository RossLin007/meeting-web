// 智会 - 登录页面

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Login.module.css';

// 图标组件
const VideoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const LoginIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
);

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

export function Login() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { isLoggedIn, isLoading, login } = useAuth();

    // 已登录用户重定向到首页
    useEffect(() => {
        if (isLoggedIn) {
            const redirectPath = localStorage.getItem('redirect_after_login') || '/';
            localStorage.removeItem('redirect_after_login');
            navigate(redirectPath, { replace: true });
        }
    }, [isLoggedIn, navigate]);

    // 切换语言
    const toggleLanguage = () => {
        const newLang = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
        i18n.changeLanguage(newLang);
    };

    // 处理登录
    const handleLogin = () => {
        login();
    };

    return (
        <div className={styles.container}>
            {/* 动态背景 */}
            <div className={styles.background} />
            <div className={styles.backgroundOrbs}>
                <div className={`${styles.orb} ${styles.orb1}`} />
                <div className={`${styles.orb} ${styles.orb2}`} />
                <div className={`${styles.orb} ${styles.orb3}`} />
            </div>

            {/* 语言切换 */}
            <div className={styles.languageSwitch}>
                <button
                    className={styles.langButton}
                    onClick={toggleLanguage}
                    aria-label={t('settings.language')}
                >
                    <GlobeIcon />
                    <span>{i18n.language === 'zh-CN' ? 'EN' : '中文'}</span>
                </button>
            </div>

            {/* 登录卡片 */}
            <div className={styles.card}>
                {/* Logo 区域 */}
                <div className={styles.logoContainer}>
                    <div className={styles.logo}>
                        <VideoIcon />
                    </div>
                    <h1 className={styles.title}>{t('login.title')}</h1>
                    <p className={styles.subtitle}>{t('login.subtitle')}</p>
                </div>

                {/* 登录按钮 */}
                <button
                    className={styles.loginButton}
                    onClick={handleLogin}
                    disabled={isLoading}
                    data-testid="login-button"
                >
                    {isLoading ? (
                        <>
                            <span className={styles.spinner} />
                            {t('login.loggingIn')}
                        </>
                    ) : (
                        <>
                            <LoginIcon />
                            {t('login.ssoLogin')}
                        </>
                    )}
                </button>

                {/* 条款提示 */}
                <p className={styles.terms}>{t('login.terms')}</p>
            </div>
        </div>
    );
}

export default Login;
