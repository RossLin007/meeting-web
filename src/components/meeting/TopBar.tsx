// 智会 - 顶部栏组件

import { useTranslation } from 'react-i18next';
import type { NetworkQuality } from '@/types';
import { ThemeSelector } from './ThemeSelector';
import { LanguageSelector } from './LanguageSelector';
import styles from './TopBar.module.css';

interface TopBarProps {
    title: string;
    roomId: string;
    networkQuality: NetworkQuality;
}

const SignalIcon = ({ quality }: { quality: NetworkQuality }) => {
    const bars = {
        excellent: 4,
        good: 3,
        fair: 2,
        poor: 1,
        unknown: 0,
    };
    const activeBars = bars[quality];

    return (
        <svg viewBox="0 0 24 24" className={styles.signalIcon}>
            {[1, 2, 3, 4].map((bar) => (
                <rect
                    key={bar}
                    x={2 + (bar - 1) * 6}
                    y={24 - bar * 5}
                    width="4"
                    height={bar * 5}
                    rx="1"
                    fill={bar <= activeBars ? 'currentColor' : '#555'}
                />
            ))}
        </svg>
    );
};

const CopyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

export function TopBar({ title, roomId, networkQuality }: TopBarProps) {
    const { t } = useTranslation();

    const handleCopyRoomId = () => {
        navigator.clipboard.writeText(roomId);
    };

    const getQualityColor = () => {
        const colors: Record<NetworkQuality, string> = {
            excellent: '#52c41a',
            good: '#52c41a',
            fair: '#faad14',
            poor: '#ff4d4f',
            unknown: '#999',
        };
        return colors[networkQuality];
    };

    const getQualityText = () => {
        const texts: Record<NetworkQuality, string> = {
            excellent: t('meeting.excellent'),
            good: t('meeting.good'),
            fair: t('meeting.fair'),
            poor: t('meeting.poor'),
            unknown: '',
        };
        return texts[networkQuality];
    };

    return (
        <div className={styles.container}>
            <div className={styles.left}>
                {/* 主题选择器 */}
                <ThemeSelector />
                <h1 className={styles.title}>{title}</h1>
            </div>

            <div className={styles.center}>
                <div className={styles.roomInfo}>
                    <span className={styles.roomId}>{roomId}</span>
                    <button className={styles.copyBtn} onClick={handleCopyRoomId} title={t('common.copy')}>
                        <CopyIcon />
                    </button>
                </div>
            </div>

            <div className={styles.right}>
                {/* 语言选择器 */}
                <LanguageSelector />
                <div className={styles.network} style={{ color: getQualityColor() }}>
                    <SignalIcon quality={networkQuality} />
                    <span className={styles.networkText}>{getQualityText()}</span>
                </div>
            </div>
        </div>
    );
}

export default TopBar;
