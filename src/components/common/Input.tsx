// 智会 - Input 组件

import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            fullWidth = false,
            className,
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

        return (
            <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                    </label>
                )}
                <div className={clsx(styles.inputWrapper, error && styles.hasError)}>
                    {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
                    <input
                        ref={ref}
                        id={inputId}
                        className={clsx(
                            styles.input,
                            leftIcon && styles.hasLeftIcon,
                            rightIcon && styles.hasRightIcon,
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
                </div>
                {error && <span className={styles.error}>{error}</span>}
                {hint && !error && <span className={styles.hint}>{hint}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
