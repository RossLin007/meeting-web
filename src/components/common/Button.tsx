// 智会 - Button 组件

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    children?: ReactNode;
}

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    className,
    children,
    ...props
}: ButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <button
            className={clsx(
                styles.button,
                styles[variant],
                styles[size],
                fullWidth && styles.fullWidth,
                loading && styles.loading,
                className
            )}
            disabled={isDisabled}
            {...props}
        >
            {loading && (
                <span className={styles.spinner}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            opacity="0.25"
                        />
                        <path
                            d="M12 2C6.47715 2 2 6.47715 2 12"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    </svg>
                </span>
            )}
            {!loading && icon && iconPosition === 'left' && (
                <span className={styles.icon}>{icon}</span>
            )}
            {children && <span className={styles.text}>{children}</span>}
            {!loading && icon && iconPosition === 'right' && (
                <span className={styles.icon}>{icon}</span>
            )}
        </button>
    );
}

export default Button;
