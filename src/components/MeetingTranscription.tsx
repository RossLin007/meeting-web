// 智会 - 会议完整转录组件

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import styles from './MeetingTranscription.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 类型定义
interface TranscriptSegment {
    userId: string;
    userName: string;
    beginTime: number;  // ms
    endTime: number;    // ms
    text: string;
}

interface MeetingTranscript {
    meetingId: string;
    meetingTitle: string;
    startTime: number;
    endTime: number;
    participants: Array<{ userId: string; userName: string }>;
    segments: TranscriptSegment[];
    fullText: string;
}

interface MeetingTranscriptionProps {
    meetingId: string;
    onSeek?: (timeMs: number) => void;
}

// 图标组件
const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const ExportIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export function MeetingTranscription({ meetingId, onSeek }: MeetingTranscriptionProps) {
    const { t } = useTranslation();

    const [transcript, setTranscript] = useState<MeetingTranscript | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'full' | 'segments'>('segments');

    // 加载会议转录
    const loadTranscription = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/meeting/${meetingId}`,
                {},
                30000
            );
            const result = await response.json();

            if (result.success && result.data) {
                setTranscript(result.data);
            } else {
                setError(result.error || t('transcription.noTranscription'));
            }
        } catch (err) {
            console.error('Failed to load meeting transcription:', err);
            setError(t('transcription.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [meetingId, t]);

    // 导出转录文本
    const exportTranscription = () => {
        if (!transcript) return;

        const content = activeTab === 'full'
            ? transcript.fullText
            : transcript.segments
                .map(seg => `[${formatTime(seg.beginTime)}] ${seg.userName}: ${seg.text}`)
                .join('\n\n');

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting_${meetingId}_transcript.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 格式化时间
    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // 根据用户名获取颜色
    const getUserColor = (userName: string): string => {
        const colors = [
            '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
            '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
        ];
        const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    useEffect(() => {
        loadTranscription();
    }, [loadTranscription]);

    // 渲染内容
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>{t('common.loading')}</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className={styles.error}>
                    <p>{error}</p>
                    <button className={styles.retryBtn} onClick={loadTranscription}>
                        {t('common.retry')}
                    </button>
                </div>
            );
        }

        if (!transcript || transcript.segments.length === 0) {
            return (
                <div className={styles.empty}>
                    <p>{t('transcription.noTranscription')}</p>
                </div>
            );
        }

        if (activeTab === 'full') {
            return (
                <div className={styles.fullText}>
                    <pre>{transcript.fullText}</pre>
                </div>
            );
        }

        // 分段视图
        return (
            <div className={styles.segments}>
                {transcript.segments.map((segment, index) => (
                    <div key={index} className={styles.segment}>
                        <div className={styles.segmentHeader}>
                            <span
                                className={styles.timestamp}
                                onClick={() => onSeek?.(segment.beginTime)}
                                title={t('transcription.clickToSeek')}
                            >
                                {formatTime(segment.beginTime)} - {formatTime(segment.endTime)}
                            </span>
                            <span
                                className={styles.speaker}
                                style={{ borderColor: getUserColor(segment.userName) }}
                            >
                                <span
                                    className={styles.speakerDot}
                                    style={{ backgroundColor: getUserColor(segment.userName) }}
                                />
                                {segment.userName}
                            </span>
                        </div>
                        <div className={styles.segmentText}>{segment.text}</div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* 头部 */}
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h2 className={styles.title}>
                        <span className={styles.titleIcon}>📝</span>
                        {t('transcription.meetingTranscript')}
                    </h2>
                    {transcript && (
                        <span className={styles.subtitle}>
                            {transcript.meetingTitle} · {transcript.participants.length} {t('transcription.participants')}
                        </span>
                    )}
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.iconBtn}
                        onClick={loadTranscription}
                        disabled={isLoading}
                        title={t('common.refresh')}
                    >
                        <span className={isLoading ? styles.spinning : ''}>
                            <RefreshIcon />
                        </span>
                    </button>
                    {transcript && (
                        <button
                            className={styles.iconBtn}
                            onClick={exportTranscription}
                            title={t('transcription.export')}
                        >
                            <ExportIcon />
                        </button>
                    )}
                </div>
            </header>

            {/* 参与者列表 */}
            {transcript && transcript.participants.length > 0 && (
                <div className={styles.participants}>
                    {transcript.participants.map((p) => (
                        <span
                            key={p.userId}
                            className={styles.participant}
                            style={{
                                backgroundColor: getUserColor(p.userName) + '20',
                                borderColor: getUserColor(p.userName),
                            }}
                        >
                            <span
                                className={styles.participantDot}
                                style={{ backgroundColor: getUserColor(p.userName) }}
                            />
                            {p.userName}
                        </span>
                    ))}
                </div>
            )}

            {/* 标签页 */}
            {transcript && (
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'segments' ? styles.active : ''}`}
                        onClick={() => setActiveTab('segments')}
                    >
                        {t('transcription.bySpeaker')}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'full' ? styles.active : ''}`}
                        onClick={() => setActiveTab('full')}
                    >
                        {t('transcription.viewAll')}
                    </button>
                </div>
            )}

            {/* 内容 */}
            <div className={styles.content}>
                {renderContent()}
            </div>
        </div>
    );
}

export default MeetingTranscription;
