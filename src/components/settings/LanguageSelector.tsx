// 智会 - 语言选择器组件

import { useTranslation } from 'react-i18next';
import styles from './ThemeSelector.module.css';

type LanguageCode = 'zh-CN' | 'en-US';

interface LanguageOption {
    value: LanguageCode;
    title: string;
    description: string;
    flag: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
    {
        value: 'zh-CN',
        title: '中文',
        description: '简体中文',
        flag: '🇨🇳',
    },
    {
        value: 'en-US',
        title: 'English',
        description: 'English (US)',
        flag: '🇺🇸',
    },
];

export function LanguageSelector() {
    const { i18n, t } = useTranslation();
    const currentLanguage = i18n.language as LanguageCode;

    const handleLanguageChange = (language: LanguageCode) => {
        i18n.changeLanguage(language);
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.label}>{t('settings.language')}</h3>
            <p className={styles.description}>{t('settings.languageDescription')}</p>

            <div className={styles.options}>
                {LANGUAGE_OPTIONS.map((option) => (
                    <div
                        key={option.value}
                        className={`${styles.option} ${currentLanguage === option.value || currentLanguage.startsWith(option.value.split('-')[0]) ? styles.selected : ''}`}
                        onClick={() => handleLanguageChange(option.value)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                handleLanguageChange(option.value);
                            }
                        }}
                    >
                        <div className={styles.optionRadio} />
                        <div className={styles.optionContent}>
                            <h4 className={styles.optionTitle}>{option.title}</h4>
                            <p className={styles.optionDesc}>{option.description}</p>
                        </div>
                        <div className={styles.optionPreview} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            background: 'var(--color-bg-secondary)'
                        }}>
                            {option.flag}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LanguageSelector;
