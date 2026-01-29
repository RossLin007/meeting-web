/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

// Polyfill localStorage for jsdom
const localStorageStore: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => localStorageStore[key] ?? null,
      setItem: (key: string, value: string) => { localStorageStore[key] = value; },
      removeItem: (key: string) => { delete localStorageStore[key]; },
      clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); },
    },
    writable: true,
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
});

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to system theme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('system');
  });

  it('should load theme from localStorage', () => {
    localStorage.setItem('zhihui_theme', 'light');
    const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
  });

  it('should save theme to localStorage when set', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('zhihui_theme')).toBe('dark');
  });

  it('should apply data-theme attribute to document element', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
    renderHook(() => useTheme(), { wrapper });

    expect(document.documentElement.getAttribute('data-theme')).toBeDefined();
  });
});
