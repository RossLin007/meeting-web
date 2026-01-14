// 智会 - 语言切换组件

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './LanguageSelector.module.css';

const languages = [
    { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
];

export function LanguageSelector() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    // 点击外部关闭下拉菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectLanguage = (langCode: string) => {
        i18n.changeLanguage(langCode);
        setIsOpen(false);
    };

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles.flag}>{currentLang.flag}</span>
                <span>{currentLang.name}</span>
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            className={clsx(
                                styles.langOption,
                                i18n.language === lang.code && styles.active
                            )}
                            onClick={() => handleSelectLanguage(lang.code)}
                        >
                            <span className={styles.flag}>{lang.flag}</span>
                            <span>{lang.name}</span>
                            {i18n.language === lang.code && (
                                <svg viewBox="0 0 24 24" fill="currentColor" className={styles.checkIcon}>
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LanguageSelector;
