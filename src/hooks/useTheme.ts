// 智会 - 主题 Hook

import { useState, useEffect, useCallback } from 'react';
import { applyTheme, getStoredTheme, getStoredMode, themes, getSystemMode } from '@/styles/themes';
import type { ThemeColor, ThemeMode } from '@/types';

export interface UseThemeReturn {
    color: ThemeColor;
    mode: ThemeMode;
    effectiveMode: 'dark' | 'light';
    setColor: (color: ThemeColor) => void;
    setMode: (mode: ThemeMode) => void;
    availableColors: ThemeColor[];
    availableModes: ThemeMode[];
}

export function useTheme(): UseThemeReturn {
    const [color, setColorState] = useState<ThemeColor>(getStoredTheme);
    const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
    const [effectiveMode, setEffectiveMode] = useState<'dark' | 'light'>(
        mode === 'system' ? getSystemMode() : mode
    );

    // 初始化时应用主题
    useEffect(() => {
        applyTheme(color, mode);
        setEffectiveMode(mode === 'system' ? getSystemMode() : mode);
    }, []);

    // 监听系统主题变化
    useEffect(() => {
        if (mode !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            const newMode = e.matches ? 'dark' : 'light';
            setEffectiveMode(newMode);
            applyTheme(color, 'system');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [mode, color]);

    // 设置主题颜色
    const setColor = useCallback((newColor: ThemeColor) => {
        setColorState(newColor);
        applyTheme(newColor, mode);
    }, [mode]);

    // 设置主题模式
    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode);
        setEffectiveMode(newMode === 'system' ? getSystemMode() : newMode);
        applyTheme(color, newMode);
    }, [color]);

    const availableColors = Object.keys(themes) as ThemeColor[];
    const availableModes: ThemeMode[] = ['light', 'dark', 'system'];

    return {
        color,
        mode,
        effectiveMode,
        setColor,
        setMode,
        availableColors,
        availableModes,
    };
}

export default useTheme;
