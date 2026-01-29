// 智会 - 顶部栏组件

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { NetworkQuality } from '@/types';
import styles from './TopBar.module.css';

interface TopBarProps {
    title: string;
    networkQuality: NetworkQuality;
    activeSpeaker?: string;  // 当前说话人名称
    latestChat?: {
        senderName: string;
        content: string;
        timestamp: number;
    };
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

const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
);

const ChatIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
);

export function TopBar({ title, networkQuality, activeSpeaker, latestChat }: TopBarProps) {
    const { t } = useTranslation();
    const [visibleChat, setVisibleChat] = useState<typeof latestChat | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 当有新聊天消息时显示，5秒后隐藏
    useEffect(() => {
        if (latestChat) {
            setVisibleChat(latestChat);

            // 清除之前的定时器
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            // 5秒后隐藏
            timerRef.current = setTimeout(() => {
                setVisibleChat(null);
            }, 5000);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [latestChat]);

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
                <h1 className={styles.title}>{title}</h1>
            </div>

            <div className={styles.center}>
                {/* 优先显示最新聊天消息，否则显示当前说话人 */}
                {visibleChat ? (
                    <div className={styles.chatNotification}>
                        <ChatIcon />
                        <span className={styles.chatSender}>{visibleChat.senderName}:</span>
                        <span className={styles.chatContent}>{visibleChat.content}</span>
                    </div>
                ) : activeSpeaker ? (
                    <div className={styles.activeSpeaker}>
                        <MicIcon />
                        <span className={styles.speakerName}>{activeSpeaker}</span>
                    </div>
                ) : null}
            </div>

            <div className={styles.right}>
                <div className={styles.network} style={{ color: getQualityColor() }} title={getQualityText()}>
                    <SignalIcon quality={networkQuality} />
                </div>
            </div>
        </div>
    );
}

export default TopBar;
