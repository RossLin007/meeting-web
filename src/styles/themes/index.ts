// 智会 - 主题配置

import type { ThemeColor, ThemeMode, ThemeConfig, ThemeModeConfig } from '@/types';

// 主题颜色配置 - 每个颜色包含暗色和亮色两套配置
export const themes: Record<ThemeColor, ThemeConfig> = {
    blue: {
        name: 'blue',
        dark: {
            primary: '#2563eb',
            primaryLight: '#3b82f6',
            primaryDark: '#1d4ed8',
            bgPage: '#0f172a',
            bgCard: '#1e293b',
            bgToolbar: '#0f172a',
            textPrimary: '#f8fafc',
            textSecondary: '#94a3b8',
        },
        light: {
            primary: '#2563eb',
            primaryLight: '#3b82f6',
            primaryDark: '#1d4ed8',
            bgPage: '#f1f5f9',
            bgCard: '#ffffff',
            bgToolbar: '#ffffff',
            textPrimary: '#0f172a',
            textSecondary: '#64748b',
        },
    },
    lightBlue: {
        name: 'lightBlue',
        dark: {
            primary: '#0ea5e9',
            primaryLight: '#38bdf8',
            primaryDark: '#0284c7',
            bgPage: '#082f49',
            bgCard: '#0c4a6e',
            bgToolbar: '#082f49',
            textPrimary: '#f0f9ff',
            textSecondary: '#7dd3fc',
        },
        light: {
            primary: '#0ea5e9',
            primaryLight: '#38bdf8',
            primaryDark: '#0284c7',
            bgPage: '#f0f9ff',
            bgCard: '#ffffff',
            bgToolbar: '#ffffff',
            textPrimary: '#0c4a6e',
            textSecondary: '#0369a1',
        },
    },
    cyan: {
        name: 'cyan',
        dark: {
            primary: '#06b6d4',
            primaryLight: '#22d3ee',
            primaryDark: '#0891b2',
            bgPage: '#083344',
            bgCard: '#164e63',
            bgToolbar: '#083344',
            textPrimary: '#ecfeff',
            textSecondary: '#67e8f9',
        },
        light: {
            primary: '#06b6d4',
            primaryLight: '#22d3ee',
            primaryDark: '#0891b2',
            bgPage: '#ecfeff',
            bgCard: '#ffffff',
            bgToolbar: '#ffffff',
            textPrimary: '#164e63',
            textSecondary: '#0e7490',
        },
    },
    red: {
        name: 'red',
        dark: {
            primary: '#dc2626',
            primaryLight: '#ef4444',
            primaryDark: '#b91c1c',
            bgPage: '#1c1917',
            bgCard: '#292524',
            bgToolbar: '#1c1917',
            textPrimary: '#fafaf9',
            textSecondary: '#fca5a5',
        },
        light: {
            primary: '#dc2626',
            primaryLight: '#ef4444',
            primaryDark: '#b91c1c',
            bgPage: '#fef2f2',
            bgCard: '#ffffff',
            bgToolbar: '#ffffff',
            textPrimary: '#450a0a',
            textSecondary: '#991b1b',
        },
    },
    pink: {
        name: 'pink',
        dark: {
            primary: '#ec4899',
            primaryLight: '#f472b6',
            primaryDark: '#db2777',
            bgPage: '#1a1a2e',
            bgCard: '#2d1f3d',
            bgToolbar: '#1a1a2e',
            textPrimary: '#fdf2f8',
            textSecondary: '#f9a8d4',
        },
        light: {
            primary: '#ec4899',
            primaryLight: '#f472b6',
            primaryDark: '#db2777',
            bgPage: '#fdf2f8',
            bgCard: '#ffffff',
            bgToolbar: '#ffffff',
            textPrimary: '#500724',
            textSecondary: '#9d174d',
        },
    },
};

export const defaultTheme: ThemeColor = 'blue';
export const defaultMode: ThemeMode = 'system';

// 获取系统偏好的模式
export function getSystemMode(): 'dark' | 'light' {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
}

// 获取实际使用的模式
export function getEffectiveMode(mode: ThemeMode): 'dark' | 'light' {
    return mode === 'system' ? getSystemMode() : mode;
}

// 应用主题到 CSS 变量
export function applyTheme(color: ThemeColor, mode: ThemeMode): void {
    const theme = themes[color];
    if (!theme) return;

    const effectiveMode = getEffectiveMode(mode);
    const config: ThemeModeConfig = theme[effectiveMode];

    const root = document.documentElement;

    // 设置模式属性（用于 CSS 选择器）
    root.setAttribute('data-theme-mode', effectiveMode);
    root.setAttribute('data-theme-color', color);

    // 主色调
    root.style.setProperty('--color-primary', config.primary);
    root.style.setProperty('--color-primary-light', config.primaryLight);
    root.style.setProperty('--color-primary-dark', config.primaryDark);

    // 背景色
    root.style.setProperty('--color-bg-page', config.bgPage);
    root.style.setProperty('--color-bg-card', config.bgCard);
    root.style.setProperty('--color-bg-toolbar', config.bgToolbar);

    // 文字色
    root.style.setProperty('--color-text-primary', config.textPrimary);
    root.style.setProperty('--color-text-secondary', config.textSecondary);

    // 保存到本地存储
    localStorage.setItem('themeColor', color);
    localStorage.setItem('themeMode', mode);
}

// 从本地存储获取主题颜色
export function getStoredTheme(): ThemeColor {
    const stored = localStorage.getItem('themeColor') as ThemeColor;
    return stored && themes[stored] ? stored : defaultTheme;
}

// 从本地存储获取主题模式
export function getStoredMode(): ThemeMode {
    const stored = localStorage.getItem('themeMode') as ThemeMode;
    return stored && ['dark', 'light', 'system'].includes(stored) ? stored : defaultMode;
}
