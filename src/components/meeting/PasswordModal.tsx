// 智会 - 会议密码验证模态框

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PasswordModal.module.css';

interface PasswordModalProps {
    roomId: string;
    onVerify: (password: string) => Promise<boolean>;
    onCancel: () => void;
}

// 图标组件
const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export function PasswordModal({ roomId, onVerify, onCancel }: PasswordModalProps) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError(t('password.required', '请输入会议密码'));
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            const isValid = await onVerify(password);
            if (!isValid) {
                setError(t('password.incorrect', '密码错误，请重试'));
            }
        } catch (err) {
            setError(t('password.verifyFailed', '验证失败，请稍后重试'));
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {/* 图标 */}
                <div className={styles.iconWrapper}>
                    <LockIcon />
                </div>

                {/* 标题 */}
                <h2 className={styles.title}>
                    {t('password.title', '会议需要密码')}
                </h2>
                <p className={styles.subtitle}>
                    {t('password.subtitle', '请输入密码以加入此会议')}
                </p>

                {/* 密码表单 */}
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputWrapper}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder={t('password.placeholder', '输入会议密码')}
                            className={styles.input}
                            autoFocus
                            disabled={isVerifying}
                        />
                        <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

                    {/* 按钮 */}
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={onCancel}
                            disabled={isVerifying}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isVerifying || !password.trim()}
                        >
                            {isVerifying
                                ? t('password.verifying', '验证中...')
                                : t('password.join', '加入会议')
                            }
                        </button>
                    </div>
                </form>

                {/* 房间号显示 */}
                <div className={styles.roomInfo}>
                    {t('password.roomId', '会议号')}: {roomId}
                </div>
            </div>
        </div>
    );
}

export default PasswordModal;
