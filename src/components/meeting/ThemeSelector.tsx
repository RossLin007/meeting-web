// 智会 - 主题选择器组件

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useTheme } from '@/hooks';
import type { ThemeColor, ThemeMode } from '@/types';
import styles from './ThemeSelector.module.css';

// 主题颜色对应的 CSS 颜色值
const themeColors: Record<ThemeColor, string> = {
    blue: '#2563eb',
    lightBlue: '#0ea5e9',
    cyan: '#06b6d4',
    red: '#dc2626',
    pink: '#ec4899',
};

// 模式图标
const modeIcons: Record<ThemeMode, ReactNode> = {
    light: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
    ),
    dark: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    ),
    system: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    ),
};

export function ThemeSelector() {
    const { t } = useTranslation();
    const { color, mode, setColor, setMode, availableColors, availableModes } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectColor = (newColor: ThemeColor) => {
        setColor(newColor);
    };

    const handleSelectMode = (newMode: ThemeMode) => {
        setMode(newMode);
    };

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles.icon}>{modeIcons[mode]}</span>
                <span>{t('theme.title')}</span>
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {/* 模式选择 */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>{t('theme.mode')}</div>
                        <div className={styles.modeList}>
                            {availableModes.map((modeOption) => (
                                <button
                                    key={modeOption}
                                    className={clsx(
                                        styles.modeOption,
                                        mode === modeOption && styles.active
                                    )}
                                    onClick={() => handleSelectMode(modeOption)}
                                    title={t(`theme.${modeOption}`)}
                                >
                                    <span className={styles.modeIcon}>{modeIcons[modeOption]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 颜色选择 */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>{t('theme.color')}</div>
                        <div className={styles.colorList}>
                            {availableColors.map((colorOption) => (
                                <button
                                    key={colorOption}
                                    className={clsx(
                                        styles.colorOption,
                                        color === colorOption && styles.active
                                    )}
                                    onClick={() => handleSelectColor(colorOption)}
                                    title={t(`theme.${colorOption}`)}
                                >
                                    <span
                                        className={styles.colorDot}
                                        style={{ backgroundColor: themeColors[colorOption] }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ThemeSelector;
