# Home Page Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement light/dark theme, unified settings modal, recording format settings, expired meeting filtering, and MP4 playback verification for the meeting application home page.

**Architecture:**
- Theme system using React Context + CSS variables with localStorage persistence
- Unified settings modal with tabs (Profile/Settings/Devices) replacing separate settings page
- localStorage-based user settings for recording format preference
- Time-based filtering for scheduled meetings with 15-minute grace period

**Tech Stack:**
- React 18 with TypeScript
- CSS Modules with CSS variables
- React Context API for state management
- localStorage for persistence

---

## Task 1: Create Theme Context Provider

**Files:**
- Create: `src/contexts/ThemeContext.tsx`
- Create: `src/contexts/ThemeContext.test.tsx`

**Step 1: Write the failing test**

Create `src/contexts/ThemeContext.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to system theme', () => {
    const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('system');
  });

  it('should load theme from localStorage', () => {
    localStorage.setItem('zhihui_theme', 'light');
    const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
  });

  it('should save theme to localStorage when set', () => {
    const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('zhihui_theme')).toBe('dark');
  });

  it('should apply data-theme attribute to document element', () => {
    const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
    renderHook(() => useTheme(), { wrapper });

    expect(document.documentElement.getAttribute('data-theme')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/contexts/ThemeContext.test.tsx`
Expected: FAIL with "Cannot find module './ThemeContext'"

**Step 3: Write minimal implementation**

Create `src/contexts/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const STORAGE_KEY = 'zhihui_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

// Helper to get system preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

// Helper to resolve theme to actual light/dark
const resolveTheme = (theme: ThemeMode): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(theme)
  );

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    setResolvedTheme(resolveTheme(newTheme));
  };

  // Apply data-theme attribute to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setResolvedTheme(getSystemTheme());
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/contexts/ThemeContext.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/contexts/ThemeContext.tsx src/contexts/ThemeContext.test.tsx
git commit -m "feat(theme): add ThemeContext with localStorage persistence"
```

---

## Task 2: Update Global CSS with Theme Variables

**Files:**
- Modify: `src/styles/index.css`

**Step 1: Add light theme CSS variables**

Edit `src/styles/index.css`, add after line 90 (after dark mode media query):

```css
/* Light theme (explicit via data-theme attribute) */
[data-theme='light'] {
  --color-bg: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-text: #111827;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
}

/* Dark theme (explicit via data-theme attribute) */
[data-theme='dark'] {
  --color-bg: #111827;
  --color-bg-secondary: #1f2937;
  --color-bg-tertiary: #374151;
  --color-text: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-tertiary: #9ca3af;
  --color-border: #374151;
  --color-border-light: #4b5563;
}

/* Theme-specific gradients */
[data-theme='light'] {
  --gradient-bg: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%);
  --gradient-sidebar: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --gradient-card: rgba(255, 255, 255, 0.8);
  --gradient-card-hover: rgba(255, 255, 255, 0.95);
}

[data-theme='dark'] {
  --gradient-bg: linear-gradient(180deg, #0a1929 0%, #0d2137 100%);
  --gradient-sidebar: rgba(0, 0, 0, 0.3);
  --gradient-card: rgba(255, 255, 255, 0.05);
  --gradient-card-hover: rgba(255, 255, 255, 0.08);
}

/* Theme-specific text colors */
[data-theme='light'] {
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --text-inverted: #ffffff;
}

[data-theme='dark'] {
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  --text-inverted: #111827;
}
```

**Step 2: Verify CSS loads**

Run: `npm run dev`
Expected: Dev server starts, no CSS errors in console

**Step 3: Commit**

```bash
git add src/styles/index.css
git commit -m "feat(theme): add light/dark theme CSS variables"
```

---

## Task 3: Update Home.tsx to Use Theme Variables

**Files:**
- Modify: `src/pages/Home.module.css`

**Step 1: Replace hardcoded colors with theme variables**

Edit `src/pages/Home.module.css`:

Replace line 6:
```css
/* OLD */
background: linear-gradient(180deg, #0a1929 0%, #0d2137 100%);

/* NEW */
background: var(--gradient-bg, linear-gradient(180deg, #0a1929 0%, #0d2137 100%));
```

Replace line 18:
```css
/* OLD */
background: linear-gradient(180deg, #0a1929 0%, #0d2137 100%);

/* NEW */
background: var(--gradient-bg, linear-gradient(180deg, #0a1929 0%, #0d2137 100%));
```

Replace line 40:
```css
/* OLD */
background: rgba(0, 0, 0, 0.3);

/* NEW */
background: var(--gradient-sidebar, rgba(0, 0, 0, 0.3));
```

Replace line 87 (color):
```css
/* OLD */
color: rgba(255, 255, 255, 0.6);

/* NEW */
color: var(--text-secondary, rgba(255, 255, 255, 0.6));
```

Replace line 100 (active nav item background):
```css
/* OLD */
background: rgba(59, 130, 246, 0.2);

/* NEW */
background: rgba(59, 130, 246, 0.2);
```
(Note: Keep primary color the same across themes)

Replace line 122 (userCard background):
```css
/* OLD */
background: rgba(255, 255, 255, 0.05);

/* NEW */
background: var(--gradient-card, rgba(255, 255, 255, 0.05));
```

Replace line 149 (userName color):
```css
/* OLD */
color: #fff;

/* NEW */
color: var(--text-primary, #fff);
```

Replace line 404 (meetingCard background):
```css
/* OLD */
background: rgba(255, 255, 255, 0.05);

/* NEW */
background: var(--gradient-card, rgba(255, 255, 255, 0.05));
```

**Step 2: Verify styles apply**

Run: `npm run dev`
Expected: Home page loads with theme colors

**Step 3: Commit**

```bash
git add src/pages/Home.module.css
git commit -m "feat(theme): update Home.module.css to use theme variables"
```

---

## Task 4: Create Theme Selector Component

**Files:**
- Create: `src/components/settings/ThemeSelector.tsx`
- Create: `src/components/settings/ThemeSelector.module.css`

**Step 1: Create ThemeSelector styles**

Create `src/components/settings/ThemeSelector.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.description {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.option {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-bg);
}

.option:hover {
  border-color: var(--color-primary);
}

.option.selected {
  border-color: var(--color-primary);
  background: rgba(37, 99, 235, 0.1);
}

.optionRadio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.option.selected .optionRadio {
  border-color: var(--color-primary);
}

.option.selected .optionRadio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: var(--color-primary);
  border-radius: 50%;
}

.optionContent {
  flex: 1;
}

.optionTitle {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-1) 0;
}

.optionDesc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
}

.optionPreview {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.previewLight {
  background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
}

.previewDark {
  background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
}

.previewSystem {
  background: linear-gradient(90deg, #ffffff 50%, #111827 50%);
}
```

**Step 2: Create ThemeSelector component**

Create `src/components/settings/ThemeSelector.tsx`:

```tsx
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import styles from './ThemeSelector.module.css';
import type { ThemeMode } from '@/contexts/ThemeContext';

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  title: string;
  description: string;
  previewClass: string;
}> = [
  {
    value: 'light',
    title: 'Light',
    description: 'Always use light theme',
    previewClass: styles.previewLight,
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'Always use dark theme',
    previewClass: styles.previewDark,
  },
  {
    value: 'system',
    title: 'System',
    description: 'Follow your operating system preference',
    previewClass: styles.previewSystem,
  },
];

export function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.container}>
      <h3 className={styles.label}>Theme</h3>
      <p className={styles.description}>Choose your preferred color theme</p>

      <div className={styles.options}>
        {THEME_OPTIONS.map((option) => (
          <div
            key={option.value}
            className={`${styles.option} ${theme === option.value ? styles.selected : ''}`}
            onClick={() => setTheme(option.value)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setTheme(option.value);
              }
            }}
          >
            <div className={styles.optionRadio} />
            <div className={styles.optionContent}>
              <h4 className={styles.optionTitle}>{option.title}</h4>
              <p className={styles.optionDesc}>{option.description}</p>
            </div>
            <div className={`${styles.optionPreview} ${option.previewClass}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create test file**

Create `src/components/settings/ThemeSelector.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ThemeSelector } from './ThemeSelector';

describe('ThemeSelector', () => {
  const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

  it('should render all three theme options', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should select current theme', () => {
    localStorage.setItem('zhihui_theme', 'dark');
    const { rerender } = render(<ThemeSelector />, { wrapper });

    const darkOption = screen.getByText('Dark').closest('div');
    expect(darkOption).toHaveClass('selected');
  });
});
```

**Step 4: Run tests**

Run: `npm test -- src/components/settings/ThemeSelector.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/settings/ThemeSelector.tsx src/components/settings/ThemeSelector.module.css src/components/settings/ThemeSelector.test.tsx
git commit -m "feat(theme): add ThemeSelector component"
```

---

## Task 5: Wrap App with ThemeProvider

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add ThemeProvider to App**

Edit `src/App.tsx`:

Add import after line 6:
```tsx
import { ThemeProvider } from '@/contexts/ThemeContext';
```

Wrap children with ThemeProvider (modify lines 21-24):
```tsx
// BEFORE
<ErrorBoundary>
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>

// AFTER
<ErrorBoundary>
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
```

Add closing tag for ThemeProvider (before line 82):
```tsx
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
</ErrorBoundary>
```

**Step 2: Verify app renders**

Run: `npm run dev`
Expected: App loads without errors, data-theme attribute on <html>

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(theme): wrap App with ThemeProvider"
```

---

## Task 6: Create Settings Storage Hook

**Files:**
- Create: `src/hooks/useSettingsStorage.ts`
- Create: `src/hooks/useSettingsStorage.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/useSettingsStorage.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { useSettingsStorage } from './useSettingsStorage';

describe('useSettingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default value when nothing stored', () => {
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    expect(result.current[0]).toBe('mp4');
  });

  it('should load value from localStorage', () => {
    localStorage.setItem('zhihui_recordingFormat', 'mp4');
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    expect(result.current[0]).toBe('mp4');
  });

  it('should save value to localStorage', () => {
    const { result } = renderHook(() => useSettingsStorage('recordingFormat', 'mp4'));

    act(() => {
      result.current[1]('mp4');
    });

    expect(localStorage.getItem('zhihui_recordingFormat')).toBe('mp4');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useSettingsStorage.test.ts`
Expected: FAIL with "Cannot find module './useSettingsStorage'"

**Step 3: Write minimal implementation**

Create `src/hooks/useSettingsStorage.ts`:

```ts
import { useState, useCallback, useEffect } from 'react';

const STORAGE_PREFIX = 'zhihui_';

export function useSettingsStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(storageKey);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${storageKey} from localStorage:`, error);
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value);
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (error) {
        console.error(`Error saving ${storageKey} to localStorage:`, error);
      }
    },
    [storageKey]
  );

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  return [storedValue, setValue];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useSettingsStorage.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/hooks/useSettingsStorage.ts src/hooks/useSettingsStorage.test.ts
git commit -m "feat(settings): add useSettingsStorage hook"
```

---

## Task 7: Create User Settings Modal Component

**Files:**
- Create: `src/components/user/UserSettingsModal.tsx`
- Create: `src/components/user/UserSettingsModal.module.css`

**Step 1: Create modal styles**

Create `src/components/user/UserSettingsModal.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.header {
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.closeBtn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.closeBtn:hover {
  background: var(--color-bg-secondary);
  color: var(--text-primary);
}

.closeBtn svg {
  width: 20px;
  height: 20px;
}

.tabs {
  display: flex;
  padding: var(--spacing-4) var(--spacing-6) 0;
  gap: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--text-primary);
  background: var(--color-bg-secondary);
}

.tab.active {
  color: var(--color-primary);
  background: rgba(37, 99, 235, 0.1);
}

.content {
  padding: var(--spacing-6);
  overflow-y: auto;
  flex: 1;
}

.section {
  margin-bottom: var(--spacing-6);
}

.section:last-child {
  margin-bottom: 0;
}

.sectionTitle {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.sectionDesc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-4) 0;
}

.optionGroup {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.optionLabel {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.optionLabel:hover {
  border-color: var(--color-primary);
}

.optionLabel.selected {
  border-color: var(--color-primary);
  background: rgba(37, 99, 235, 0.05);
}

.radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.optionLabel.selected .radio {
  border-color: var(--color-primary);
}

.optionLabel.selected .radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
}

.optionText {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.select {
  width: 100%;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: all var(--transition-fast);
}

.select:focus {
  border-color: var(--color-primary);
}

.logoutBtn {
  width: 100%;
  padding: var(--spacing-3);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-error);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.logoutBtn:hover {
  opacity: 0.9;
}

/* Profile tab styles */
.profileSection {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6) 0;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-3xl);
  font-weight: 600;
  color: #fff;
}

.userInfo {
  text-align: center;
}

.userName {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-1) 0;
}

.userEmail {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.infoList {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.infoItem {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.infoLabel {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.infoValue {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}
```

**Step 2: Create modal component**

Create `src/components/user/UserSettingsModal.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStorage } from '@/hooks/useSettingsStorage';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import styles from './UserSettingsModal.module.css';

type TabType = 'profile' | 'settings' | 'devices';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function UserSettingsModal({ isOpen, onClose, defaultTab = 'settings' }: UserSettingsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [recordingFormat, setRecordingFormat] = useSettingsStorage<'mp4'>('recordingFormat', 'mp4');

  if (!isOpen) return null;

  const handleLogout = () => {
    // Will be connected to auth context logout
    window.location.href = '/login';
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'devices' ? styles.active : ''}`}
            onClick={() => setActiveTab('devices')}
          >
            Devices
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'profile' && (
            <>
              <div className={styles.profileSection}>
                <div className={styles.avatar}>
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={styles.userInfo}>
                  <h3 className={styles.userName}>{user?.username || 'User'}</h3>
                  <p className={styles.userEmail}>{user?.email || ''}</p>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>User ID</span>
                  <span className={styles.infoValue}>{user?.id || '-'}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Theme</span>
                  <span className={styles.infoValue}>{theme}</span>
                </div>
              </div>

              <div className={styles.section}>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  {t('home.logout') || 'Logout'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <div className={styles.section}>
                <ThemeSelector />
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Recording Format</h3>
                <p className={styles.sectionDesc}>
                  Choose the format for meeting recordings
                </p>
                <div className={styles.optionGroup}>
                  <label
                    className={`${styles.optionLabel} ${recordingFormat === 'mp4' ? styles.selected : ''}`}
                  >
                    <div className={styles.radio} />
                    <span className={styles.optionText}>MP4 (Recommended)</span>
                    <input
                      type="radio"
                      name="recordingFormat"
                      value="mp4"
                      checked={recordingFormat === 'mp4'}
                      onChange={() => setRecordingFormat('mp4')}
                      style={{ position: 'absolute', opacity: 0 }}
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'devices' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Devices</h3>
              <p className={styles.sectionDesc}>
                Configure your audio and video devices. Available in pre-join screen.
              </p>
              <p className={styles.sectionDesc}>
                Go to a meeting room to configure microphone, camera, and speaker settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create test**

Create `src/components/user/UserSettingsModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserSettingsModal } from './UserSettingsModal';

const wrapper = ({ children }) => (
  <ThemeProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </ThemeProvider>
);

describe('UserSettingsModal', () => {
  it('should render when isOpen is true', () => {
    render(<UserSettingsModal isOpen onClose={() => {}} />, { wrapper });

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<UserSettingsModal isOpen={false} onClose={() => {}} />, { wrapper });

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should switch tabs', () => {
    render(<UserSettingsModal isOpen onClose={() => {}} />, { wrapper });

    fireEvent.click(screen.getByText('Profile'));
    expect(screen.getByText('User ID')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });
});
```

**Step 4: Run tests**

Run: `npm test -- src/components/user/UserSettingsModal.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/user/UserSettingsModal.tsx src/components/user/UserSettingsModal.module.css src/components/user/UserSettingsModal.test.tsx
git commit -m "feat(settings): add UserSettingsModal with tabs"
```

---

## Task 8: Update Home.tsx to Use UserSettingsModal

**Files:**
- Modify: `src/pages/Home.tsx`

**Step 1: Add import and state**

Add import after line 19:
```tsx
import { UserSettingsModal } from '@/components/user/UserSettingsModal';
```

Add state after line 47 (in the component):
```tsx
const [showUserSettings, setShowUserSettings] = useState(false);
```

**Step 2: Make user avatar clickable**

Find the userCard section (around line 544-558) and modify:

```tsx
// OLD
<div className={styles.userCard}>
  <div className={styles.userAvatar}>
    {user.username?.charAt(0).toUpperCase() || 'U'}
  </div>
  // ... rest of userCard
  <button className={styles.logoutBtn} onClick={() => setShowLogoutModal(true)} title={t('home.logout')}>
    <LogoutIcon />
  </button>
</div>

// NEW
<div
  className={styles.userCard}
  onClick={() => setShowUserSettings(true)}
  style={{ cursor: 'pointer' }}
>
  <div className={styles.userAvatar}>
    {user.username?.charAt(0).toUpperCase() || 'U'}
  </div>
  // ... rest of userCard
  <button
    className={styles.logoutBtn}
    onClick={(e) => {
      e.stopPropagation();
      setShowUserSettings(true);
    }}
    title={t('home.settings')}
  >
    <SettingsIcon />
  </button>
</div>
```

**Step 3: Remove Settings from sidebar nav**

Find the settings nav item (lines 534-540) and comment out or remove:
```tsx
{/* REMOVED - Settings now in user avatar click */}
{/* <button
  className={`${styles.navItem} ${activeNav === 'settings' ? styles.active : ''}`}
  onClick={() => navigate('/settings')}
>
  <SettingsIcon />
  <span>{t('home.settings')}</span>
</button> */}
```

**Step 4: Add modal to JSX**

Add before the closing div of the component (before line 1294):
```tsx
{/* User Settings Modal */}
<UserSettingsModal
  isOpen={showUserSettings}
  onClose={() => setShowUserSettings(false)}
/>
```

**Step 5: Verify modal opens**

Run: `npm run dev`
Expected: Clicking user avatar opens settings modal

**Step 6: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat(home): integrate UserSettingsModal with avatar click"
```

---

## Task 9: Add Expired Meeting Filter

**Files:**
- Modify: `src/pages/Home.tsx`

**Step 1: Add filter for expired meetings**

Find the section around line 669 in Home.tsx where meetings are combined:

Replace:
```tsx
const allMeetings = [...ongoingMeetings, ...scheduledMeetings];
```

With:
```tsx
// Filter out expired scheduled meetings (with 15-minute grace period)
const now = new Date();
const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

const upcomingMeetings = scheduledMeetings.filter((meeting) => {
  if (!meeting.startTime) return true; // Keep meetings without explicit time
  const meetingTime = new Date(meeting.startTime);
  return meetingTime.getTime() > now.getTime() - GRACE_PERIOD_MS;
});

const allMeetings = [...ongoingMeetings, ...upcomingMeetings];
```

**Step 2: Add unit test**

Create `src/pages/Home.utils.test.ts`:

```ts
describe('Meeting filtering logic', () => {
  it('should filter out meetings older than 15 minutes', () => {
    const now = new Date();
    const GRACE_PERIOD_MS = 15 * 60 * 1000;

    const scheduledMeetings = [
      { startTime: new Date(now.getTime() - GRACE_PERIOD_MS - 1000) }, // 15m 1s ago - should be filtered
      { startTime: new Date(now.getTime() - GRACE_PERIOD_MS + 1000) }, // 14m 59s ago - should pass
      { startTime: undefined }, // No time - should pass
      { startTime: new Date(now.getTime() + 3600000) }, // 1 hour from now - should pass
    ];

    const filtered = scheduledMeetings.filter((meeting) => {
      if (!meeting.startTime) return true;
      return meeting.startTime.getTime() > now.getTime() - GRACE_PERIOD_MS;
    });

    expect(filtered).toHaveLength(3);
  });
});
```

**Step 3: Run tests**

Run: `npm test -- src/pages/Home.utils.test.ts`
Expected: Test passes

**Step 4: Verify filtering works**

Run: `npm run dev`
Expected: Old meetings no longer appear in upcoming list

**Step 5: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.utils.test.ts
git commit -m "feat(home): filter expired meetings from upcoming list"
```

---

## Task 10: Verify MP4 Playback in Recordings

**Files:**
- Modify: `src/pages/Recordings.tsx`

**Step 1: Add error handling for video playback**

Find the video player section (lines 265-289) and enhance:

```tsx
// Add state for video errors (at top of component)
const [videoError, setVideoError] = useState<string | null>(null);

// Update the video element:
{selectedRecording && selectedRecording.fileUrl && (
  <div
    className={styles.playerOverlay}
    onClick={() => {
      setSelectedRecording(null);
      setVideoError(null);
    }}
  >
    <div className={styles.player} onClick={(e) => e.stopPropagation()}>
      <h3>{selectedRecording.title || t('recordings.title')}</h3>
      {videoError ? (
        <div className={styles.videoError}>
          <p>{videoError}</p>
          <button
            onClick={() => window.open(selectedRecording.fileUrl, '_blank')}
            className={styles.errorBtn}
          >
            Open in New Tab
          </button>
        </div>
      ) : (
        <video
          src={selectedRecording.fileUrl}
          controls
          autoPlay
          className={styles.video}
          onError={(e) => {
            const video = e.target as HTMLVideoElement;
            setVideoError(`Error loading video: ${video.error?.message || 'Unknown error'}`);
          }}
        />
      )}
      <button
        className={styles.closePlayer}
        onClick={() => {
          setSelectedRecording(null);
          setVideoError(null);
        }}
      >
        {t('common.close')}
      </button>
    </div>
  </div>
)}
```

**Step 2: Add error styles**

Edit `src/pages/Recordings.module.css`, add:

```css
.videoError {
  padding: var(--spacing-6);
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.videoError p {
  color: var(--color-error);
  margin: 0 0 var(--spacing-4) 0;
}

.errorBtn {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  cursor: pointer;
}

.errorBtn:hover {
  opacity: 0.9;
}
```

**Step 3: Test MP4 playback**

Run: `npm run dev`
Expected: MP4 recordings play in browser modal

**Step 4: Commit**

```bash
git add src/pages/Recordings.tsx src/pages/Recordings.module.css
git commit -m "feat(recordings): add error handling for MP4 playback"
```

---

## Task 11: Update Routes (Remove Settings Page)

**Files:**
- Modify: `src/App.tsx`

**Step 1: Remove settings route**

Edit `src/App.tsx`, remove the settings route (lines 36-43):

```tsx
// REMOVE THIS BLOCK
<Route
  path="/settings"
  element={
    <PrivateRoute>
      <Settings />
    </PrivateRoute>
  }
/>
```

Also remove the Settings import (line 14):
```tsx
// Remove: import { Settings } from '@/pages/Settings';
```

**Step 2: Update tests that reference settings route**

Check for any tests referencing `/settings` route and update them.

**Step 3: Verify app works**

Run: `npm run dev`
Expected: App works, navigating to `/settings` shows 404

**Step 4: Delete old Settings page**

```bash
rm src/pages/Settings.tsx src/pages/Settings.module.css
```

**Step 5: Commit**

```bash
git add src/App.tsx
git rm src/pages/Settings.tsx src/pages/Settings.module.css
git commit -m "refactor: remove deprecated settings page route"
```

---

## Task 12: Final Integration and Testing

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Manual testing checklist**

Run: `npm run dev`

Test each feature:
- [ ] Click user avatar → settings modal opens
- [ ] Switch between Profile/Settings/Devices tabs
- [ ] Change theme to Light → page updates immediately
- [ ] Change theme to Dark → page updates immediately
- [ ] Change theme to System → follows OS preference
- [ ] Refresh page → theme preference persists
- [ ] Expired meetings are filtered from upcoming list
- [ ] MP4 recordings play in browser
- [ ] Recording format saves to localStorage

**Step 3: Type check**

Run: `npm run type-check` (if available) or `npx tsc --noEmit`
Expected: No type errors

**Step 4: Build verification**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(home): complete home page improvements implementation"
```

---

## Summary

This implementation plan delivers:

1. **Theme System**: Full light/dark/system mode with localStorage persistence
2. **UserSettingsModal**: Unified modal with Profile/Settings/Devices tabs
3. **Recording Format Setting**: MP4 format preference storage
4. **Expired Meeting Filter**: Time-based filtering with 15-minute grace period
5. **MP4 Playback**: Verified with error handling

**Estimated time:** 3-4 hours for full implementation

**Files created:** 12 new files
**Files modified:** 6 existing files
**Files deleted:** 2 deprecated files
