// 智会 - 布局选择器组件

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './LayoutSelector.module.css';

// 布局类型
export type LayoutType = 'gallery' | 'speaker' | 'focus' | 'sideBySide' | 'float';

export interface LayoutOption {
    type: LayoutType;
    label: string;
    icon: React.ReactNode;
    description: string;
}

interface LayoutSelectorProps {
    currentLayout: LayoutType;
    onLayoutChange: (layout: LayoutType) => void;
    onClose: () => void;
}

// 布局图标
const GalleryIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <rect x="2" y="2" width="9" height="9" rx="1" />
        <rect x="13" y="2" width="9" height="9" rx="1" />
        <rect x="2" y="13" width="9" height="9" rx="1" />
        <rect x="13" y="13" width="9" height="9" rx="1" />
    </svg>
);

const SpeakerIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <rect x="2" y="2" width="20" height="15" rx="1" />
        <rect x="2" y="19" width="5" height="3" rx="0.5" />
        <rect x="9" y="19" width="5" height="3" rx="0.5" />
        <rect x="16" y="19" width="6" height="3" rx="0.5" />
    </svg>
);

const FocusIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <rect x="2" y="2" width="20" height="20" rx="1" />
    </svg>
);

const SideBySideIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <rect x="2" y="2" width="9" height="20" rx="1" />
        <rect x="13" y="2" width="9" height="20" rx="1" />
    </svg>
);

const FloatIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <rect x="2" y="2" width="20" height="20" rx="1" opacity="0.5" />
        <rect x="14" y="14" width="8" height="8" rx="1" />
    </svg>
);

export function LayoutSelector({
    currentLayout,
    onLayoutChange,
    onClose,
}: LayoutSelectorProps) {
    const { t } = useTranslation();

    const layouts: LayoutOption[] = [
        {
            type: 'gallery',
            label: t('layout.gallery'),
            icon: <GalleryIcon />,
            description: t('layout.galleryDesc'),
        },
        {
            type: 'speaker',
            label: t('layout.speaker'),
            icon: <SpeakerIcon />,
            description: t('layout.speakerDesc'),
        },
        {
            type: 'focus',
            label: t('layout.focus'),
            icon: <FocusIcon />,
            description: t('layout.focusDesc'),
        },
        {
            type: 'sideBySide',
            label: t('layout.sideBySide'),
            icon: <SideBySideIcon />,
            description: t('layout.sideBySideDesc'),
        },
        {
            type: 'float',
            label: t('layout.float'),
            icon: <FloatIcon />,
            description: t('layout.floatDesc'),
        },
    ];

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.container} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>{t('layout.title')}</h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className={styles.layouts}>
                    {layouts.map((layout) => (
                        <button
                            key={layout.type}
                            className={clsx(
                                styles.layoutItem,
                                currentLayout === layout.type && styles.active
                            )}
                            onClick={() => {
                                onLayoutChange(layout.type);
                                onClose();
                            }}
                        >
                            <div className={styles.icon}>{layout.icon}</div>
                            <div className={styles.info}>
                                <div className={styles.label}>{layout.label}</div>
                                <div className={styles.desc}>{layout.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default LayoutSelector;
