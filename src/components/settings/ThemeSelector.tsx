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
