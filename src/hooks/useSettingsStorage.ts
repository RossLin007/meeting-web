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
