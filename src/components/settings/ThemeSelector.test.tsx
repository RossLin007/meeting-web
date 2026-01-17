/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ThemeSelector } from './ThemeSelector';

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// Polyfill localStorage for jsdom
const localStorageStore: Record<string, string> = {};
beforeEach(() => {
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

  localStorage.clear();
});

describe('ThemeSelector', () => {
  const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

  afterEach(() => {
    cleanup();
  });

  it('should render all three theme options', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should have clickable theme options', () => {
    render(<ThemeSelector />, { wrapper });

    const lightOption = screen.getByText('Light').closest('[role="button"]');
    const darkOption = screen.getByText('Dark').closest('[role="button"]');
    const systemOption = screen.getByText('System').closest('[role="button"]');

    expect(lightOption).toBeInTheDocument();
    expect(darkOption).toBeInTheDocument();
    expect(systemOption).toBeInTheDocument();
  });

  it('should display theme descriptions', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByText('Always use light theme')).toBeInTheDocument();
    expect(screen.getByText('Always use dark theme')).toBeInTheDocument();
    expect(screen.getByText('Follow your operating system preference')).toBeInTheDocument();
  });
});
