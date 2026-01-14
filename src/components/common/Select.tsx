// 智会 - 下拉选择组件

import { type SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    label?: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, options, error, hint, fullWidth, size = 'md', className, ...props }, ref) => {
        return (
            <div className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ''} ${className || ''}`}>
                {label && <label className={styles.label}>{label}</label>}
                <div className={styles.selectWrapper}>
                    <select
                        ref={ref}
                        className={`${styles.select} ${styles[size]} ${error ? styles.error : ''}`}
                        {...props}
                    >
                        {options.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <div className={styles.arrow}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>
                {hint && !error && <span className={styles.hint}>{hint}</span>}
                {error && <span className={styles.errorText}>{error}</span>}
            </div>
        );
    }
);

Select.displayName = 'Select';

export default Select;
