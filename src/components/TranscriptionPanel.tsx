// 智会 - 转录面板组件

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import styles from './TranscriptionPanel.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 类型定义
interface TranscriptionSegment {
    speakerId: number;
    beginTime: number;  // ms
    endTime: number;    // ms
    text: string;
}

interface TranscriptionData {
    id: string;
    recordingId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    fullText: string | null;
    errorMessage: string | null;
    segments: TranscriptionSegment[];
    speakerLabels: Record<number, string>;
}

interface Participant {
    userId: string;
    userName: string;
    email?: string;
}

interface TranscriptionPanelProps {
    recordingId: string;
    onSeek?: (timeMs: number) => void;  // 点击时间戳时跳转
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

const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
);

export function TranscriptionPanel({ recordingId, onSeek }: TranscriptionPanelProps) {
    const { t } = useTranslation();

    const [transcription, setTranscription] = useState<TranscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [activeTab, setActiveTab] = useState<'full' | 'segments'>('segments');
    const [editingSpeaker, setEditingSpeaker] = useState<{ id: number; label: string } | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);

    // 加载转录数据
    const loadTranscription = useCallback(async () => {
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/recording/${recordingId}`,
                {},
                30000
            );
            const result = await response.json();

            if (result.success && result.data) {
                setTranscription(result.data);

                // 如果正在处理中，自动同步状态
                if (result.data.status === 'processing') {
                    await syncStatus(result.data.id);
                }
            } else {
                setTranscription(null);
            }
        } catch (error) {
            console.error('Failed to load transcription:', error);
        } finally {
            setIsLoading(false);
        }
    }, [recordingId]);

    // 加载会议参与者
    const loadParticipants = useCallback(async (transcriptionId: string) => {
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/${transcriptionId}/participants`,
                {},
                10000
            );
            const result = await response.json();
            if (result.success && result.data) {
                setParticipants(result.data);
            }
        } catch (error) {
            console.error('Failed to load participants:', error);
        }
    }, []);

    // 同步转录状态
    const syncStatus = async (transcriptionId: string) => {
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/${transcriptionId}/sync`,
                { method: 'POST' },
                60000
            );
            const result = await response.json();

            if (result.success && result.status === 'completed') {
                // 重新加载完整数据
                await loadTranscription();
            }
        } catch (error) {
            console.error('Failed to sync transcription:', error);
        }
    };

    // 开始转录
    const startTranscription = async () => {
        setIsStarting(true);
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/start`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordingId }),
                },
                30000
            );
            const result = await response.json();

            if (result.success) {
                // 重新加载
                await loadTranscription();
            } else {
                alert(result.error || t('transcription.startFailed'));
            }
        } catch (error) {
            console.error('Failed to start transcription:', error);
            alert(t('transcription.startFailed'));
        } finally {
            setIsStarting(false);
        }
    };

    // 更新说话人标签
    const updateSpeakerLabel = async (speakerId: number, label: string) => {
        if (!transcription) return;

        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/${transcription.id}/speakers`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ speakerId, label }),
                },
                10000
            );
            const result = await response.json();

            if (result.success) {
                setTranscription(prev => prev ? {
                    ...prev,
                    speakerLabels: { ...prev.speakerLabels, [speakerId]: label },
                } : null);
                setEditingSpeaker(null);
            }
        } catch (error) {
            console.error('Failed to update speaker label:', error);
        }
    };

    // 导出转录文本
    const exportTranscription = () => {
        if (!transcription) return;

        let content = '';
        if (activeTab === 'full') {
            content = transcription.fullText || '';
        } else {
            for (const segment of transcription.segments) {
                const speaker = transcription.speakerLabels[segment.speakerId] || `Speaker ${segment.speakerId}`;
                const time = formatTime(segment.beginTime);
                content += `[${time}] ${speaker}: ${segment.text}\n\n`;
            }
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcription_${recordingId}.txt`;
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

    useEffect(() => {
        loadTranscription();
    }, [loadTranscription]);

    // 自动轮询处理中的任务
    useEffect(() => {
        if (transcription?.status === 'processing') {
            const interval = setInterval(() => {
                if (transcription.id) {
                    syncStatus(transcription.id);
                }
            }, 10000); // 每10秒检查一次
            return () => clearInterval(interval);
        }
    }, [transcription?.status, transcription?.id]);

    // 加载参与者列表
    useEffect(() => {
        if (transcription?.id && transcription.status === 'completed') {
            loadParticipants(transcription.id);
        }
    }, [transcription?.id, transcription?.status, loadParticipants]);

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

        if (!transcription) {
            return (
                <div className={styles.empty}>
                    <h3>{t('transcription.noTranscription')}</h3>
                    <p>{t('transcription.startPrompt')}</p>
                    <button
                        className={styles.startBtn}
                        onClick={startTranscription}
                        disabled={isStarting}
                    >
                        <MicIcon />
                        {isStarting ? t('common.loading') : t('transcription.startTranscription')}
                    </button>
                </div>
            );
        }

        if (transcription.status === 'pending' || transcription.status === 'processing') {
            return (
                <div className={styles.processing}>
                    <div className={styles.spinner} />
                    <h3>{t('transcription.status.processing')}</h3>
                    <p>{t('transcription.processingHint')}</p>
                </div>
            );
        }

        if (transcription.status === 'failed') {
            return (
                <div className={styles.error}>
                    <h3>{t('transcription.status.failed')}</h3>
                    <p>{transcription.errorMessage || t('transcription.unknownError')}</p>
                    <button className={styles.startBtn} onClick={startTranscription}>
                        {t('common.retry')}
                    </button>
                </div>
            );
        }

        // 已完成
        if (activeTab === 'full') {
            return (
                <div className={styles.fullText}>
                    {transcription.fullText || t('transcription.noContent')}
                </div>
            );
        }

        // 分段视图
        return (
            <div className={styles.segments}>
                {transcription.segments.map((segment, index) => (
                    <div key={index} className={styles.segment}>
                        <div className={styles.segmentHeader}>
                            <div className={styles.segmentMeta}>
                                <span
                                    className={styles.timestamp}
                                    onClick={() => onSeek?.(segment.beginTime)}
                                    title={t('transcription.clickToSeek')}
                                >
                                    {formatTime(segment.beginTime)} - {formatTime(segment.endTime)}
                                </span>
                                <span className={styles.speaker}>
                                    <span className={styles.speakerIcon}>👤</span>
                                    {transcription.speakerLabels[segment.speakerId] || `${t('transcription.speaker')} ${segment.speakerId + 1}`}
                                </span>
                            </div>
                            <button
                                className={styles.editBtn}
                                onClick={() => setEditingSpeaker({
                                    id: segment.speakerId,
                                    label: transcription.speakerLabels[segment.speakerId] || `${t('transcription.speaker')} ${segment.speakerId + 1}`,
                                })}
                                title={t('transcription.editLabel')}
                            >
                                ✏️ {t('transcription.edit')}
                            </button>
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
                <h2 className={styles.title}>
                    <span className={styles.titleIcon}>📝</span>
                    {t('transcription.title')}
                </h2>
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
                    {transcription?.status === 'completed' && (
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

            {/* 标签页 */}
            {transcription?.status === 'completed' && (
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'full' ? styles.active : ''}`}
                        onClick={() => setActiveTab('full')}
                    >
                        {t('transcription.viewAll')}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'segments' ? styles.active : ''}`}
                        onClick={() => setActiveTab('segments')}
                    >
                        {t('transcription.bySpeaker')}
                    </button>
                </div>
            )}

            {/* 内容 */}
            <div className={styles.content}>
                {renderContent()}
            </div>

            {/* 编辑说话人标签对话框 */}
            {editingSpeaker && (
                <div className={styles.modal} onClick={() => setEditingSpeaker(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>{t('transcription.editSpeakerLabel')}</h3>

                        {/* 参与者下拉列表 */}
                        {participants.length > 0 && (
                            <div className={styles.participantList}>
                                <p>{t('transcription.selectParticipant') || '选择参与者：'}</p>
                                <div className={styles.participantButtons}>
                                    {participants.map((p) => (
                                        <button
                                            key={p.userId}
                                            className={`${styles.participantBtn} ${editingSpeaker.label === p.userName ? styles.selected : ''}`}
                                            onClick={() => setEditingSpeaker({ ...editingSpeaker, label: p.userName })}
                                        >
                                            👤 {p.userName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 手动输入 */}
                        <p>{t('transcription.orEnterManually') || '或手动输入：'}</p>
                        <input
                            type="text"
                            value={editingSpeaker.label}
                            onChange={(e) => setEditingSpeaker({ ...editingSpeaker, label: e.target.value })}
                            placeholder={t('transcription.speakerLabelPlaceholder')}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') updateSpeakerLabel(editingSpeaker.id, editingSpeaker.label);
                                if (e.key === 'Escape') setEditingSpeaker(null);
                            }}
                        />
                        <div className={styles.modalActions}>
                            <button onClick={() => setEditingSpeaker(null)}>
                                {t('common.cancel')}
                            </button>
                            <button
                                className={styles.primary}
                                onClick={() => updateSpeakerLabel(editingSpeaker.id, editingSpeaker.label)}
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TranscriptionPanel;
