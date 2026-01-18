import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import styles from './ThemeSelector.module.css';
import type { ThemeMode } from '@/contexts/ThemeContext';

interface ThemeOption {
  value: ThemeMode;
  titleKey: string;
  descriptionKey: string;
  previewClass: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    titleKey: 'settings.themeLight',
    descriptionKey: 'settings.themeLightDesc',
    previewClass: 'previewLight',
  },
  {
    value: 'dark',
    titleKey: 'settings.themeDark',
    descriptionKey: 'settings.themeDarkDesc',
    previewClass: 'previewDark',
  },
  {
    value: 'system',
    titleKey: 'settings.themeSystem',
    descriptionKey: 'settings.themeSystemDesc',
    previewClass: 'previewSystem',
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <h3 className={styles.label}>{t('settings.theme')}</h3>
      <p className={styles.description}>{t('settings.themeDescription')}</p>

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
              <h4 className={styles.optionTitle}>{t(option.titleKey)}</h4>
              <p className={styles.optionDesc}>{t(option.descriptionKey)}</p>
            </div>
            <div className={`${styles.optionPreview} ${styles[option.previewClass]}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

