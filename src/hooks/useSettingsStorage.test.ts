/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettingsStorage } from './useSettingsStorage';

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
});

describe('useSettingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default value when nothing stored', () => {
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    expect(result.current[0]).toBe('mp4');
  });

  it('should load value from localStorage', () => {
    localStorage.setItem('zhihui_recordingFormat', JSON.stringify('mp4'));
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    expect(result.current[0]).toBe('mp4');
  });

  it('should save value to localStorage', () => {
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    act(() => {
      result.current[1]('mp4');
    });

    expect(localStorage.getItem('zhihui_recordingFormat')).toBe(JSON.stringify('mp4'));
  });
});
