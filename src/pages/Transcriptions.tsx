// 智会 - 转录列表页面

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import styles from './Transcriptions.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TranscriptionItem {
    taskId: number;
    meetingId: string;
    roomId: string;
    trtcTaskId: string | null;
    meetingTitle: string;
    startedAt: number | null;
    endedAt: number | null;
    recordingCount: number;
    completedCount: number;
    failedCount: number;
    transcriptionStatus: 'none' | 'processing' | 'completed' | 'failed';
    lastTranscriptAt: number | null;
    taskError?: string | null;
    createdAt: number;
}

// 图标组件
const TranscriptIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const EmptyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

function formatDateTime(timestamp: number | null): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function Transcriptions() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();

    const [items, setItems] = useState<TranscriptionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [triggering, setTriggering] = useState<string | null>(null);

    // 加载转录列表
    const loadTranscriptions = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            const url = `${API_URL}/api/transcription/list`;
            const response = await fetchWithTimeout(url, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                setItems(result.data);
            } else {
                throw new Error(result.error || 'Failed to load transcriptions');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadTranscriptions();
    }, [loadTranscriptions]);

    // 下载转录
    const handleDownload = async (item: TranscriptionItem, format: 'txt' | 'json' = 'txt') => {
        const downloadKey = `${item.roomId}-${item.trtcTaskId || 'all'}`;
        setDownloading(downloadKey);
        try {
            // 使用 meetingId 路由（向后兼容），但可以扩展为支持 roomId + trtcTaskId
            const url = `${API_URL}/api/transcription/meeting/${item.meetingId}/download?format=${format}`;
            const response = await fetchWithTimeout(url, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 下载文件
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const filename = item.trtcTaskId
                ? `transcription_${item.roomId}_${item.trtcTaskId}.${format}`
                : `transcription_${item.meetingId}.${format}`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Download failed:', err);
            alert(t('transcriptions.downloadFailed', 'Download failed'));
        } finally {
            setDownloading(null);
        }
    };

    // 手动触发转录
    const handleTrigger = async (item: TranscriptionItem) => {
        const triggerKey = `${item.roomId}-${item.trtcTaskId || 'all'}`;
        setTriggering(triggerKey);
        try {
            const url = `${API_URL}/api/transcription/trigger`;
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId: item.meetingId,
                    roomId: item.roomId,
                    trtcTaskId: item.trtcTaskId
                }),
            });

            const result = await response.json();
            if (result.success) {
                // 更新本地状态为处理中
                setItems(prev => prev.map(i =>
                    i.taskId === item.taskId
                        ? { ...i, transcriptionStatus: 'processing' as const }
                        : i
                ));
                alert(t('transcriptions.triggerSuccess', 'Transcription task started'));
            } else {
                alert(result.error || t('transcriptions.triggerFailed', 'Failed to start transcription'));
            }
        } catch (err) {
            console.error('Trigger failed:', err);
            alert(t('transcriptions.triggerFailed', 'Failed to start transcription'));
        } finally {
            setTriggering(null);
        }
    };

    // 状态显示
    const renderStatus = (status: TranscriptionItem['transcriptionStatus']) => {
        switch (status) {
            case 'completed':
                return (
                    <span className={`${styles.status} ${styles.statusCompleted}`}>
                        <CheckIcon />
                        {t('transcriptions.completed', 'Completed')}
                    </span>
                );
            case 'processing':
                return (
                    <span className={`${styles.status} ${styles.statusProcessing}`}>
                        <ClockIcon />
                        {t('transcriptions.processing', 'Processing')}
                    </span>
                );
            case 'failed':
                return (
                    <span className={`${styles.status} ${styles.statusFailed}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {t('transcriptions.failed', 'Failed')}
                    </span>
                );
            default:
                return (
                    <span className={`${styles.status} ${styles.statusNone}`}>
                        <EmptyIcon />
                        {t('transcriptions.none', 'None')}
                    </span>
                );
        }
    };

    // 未登录
    if (!user) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <p>{t('common.pleaseLogin', 'Please login first')}</p>
                    <button onClick={() => navigate('/login')} className={styles.primaryButton}>
                        {t('common.login', 'Login')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* 头部 */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <TranscriptIcon />
                    <h1>{t('transcriptions.title', 'Meeting Transcriptions')}</h1>
                </div>
                <button
                    onClick={loadTranscriptions}
                    className={styles.refreshButton}
                    disabled={loading}
                >
                    <RefreshIcon />
                    {t('common.refresh', 'Refresh')}
                </button>
            </header>

            {/* 内容 */}
            <main className={styles.main}>
                {loading && items.length === 0 ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>{t('common.loading', 'Loading...')}</p>
                    </div>
                ) : error ? (
                    <div className={styles.error}>
                        <p>{error}</p>
                        <button onClick={loadTranscriptions} className={styles.primaryButton}>
                            {t('common.retry', 'Retry')}
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div className={styles.emptyState}>
                        <TranscriptIcon />
                        <p>{t('transcriptions.empty', 'No transcriptions yet')}</p>
                        <p className={styles.hint}>
                            {t('transcriptions.emptyHint', 'Transcriptions will appear here after meetings end')}
                        </p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {items.map((item) => {
                            const itemKey = `${item.roomId}-${item.trtcTaskId || item.taskId}`;
                            return (
                                <div key={itemKey} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.meetingTitle}>{item.meetingTitle}</h3>
                                        {renderStatus(item.transcriptionStatus)}
                                    </div>

                                    <div className={styles.cardMeta}>
                                        <span>
                                            <ClockIcon />
                                            {formatDateTime(item.createdAt || item.startedAt)}
                                        </span>
                                        {item.trtcTaskId && (
                                            <span title={t('transcriptions.taskId', 'Task ID')}>
                                                📋 {item.trtcTaskId.substring(0, 12)}...
                                            </span>
                                        )}
                                        <span>
                                            {t('transcriptions.recordings', 'Recordings')}: {item.recordingCount}
                                            {item.completedCount > 0 && ` (${item.completedCount}✓)`}
                                            {item.failedCount > 0 && ` (${item.failedCount}✗)`}
                                        </span>
                                    </div>

                                    <div className={styles.cardActions}>
                                        <button
                                            onClick={() => navigate(`/recordings?meetingId=${item.meetingId}`)}
                                            className={styles.secondaryButton}
                                        >
                                            {t('transcriptions.viewDetails', 'View Details')}
                                        </button>

                                        {item.transcriptionStatus === 'completed' && (
                                            <>
                                                <button
                                                    onClick={() => handleDownload(item, 'txt')}
                                                    className={styles.primaryButton}
                                                    disabled={downloading === itemKey}
                                                >
                                                    <DownloadIcon />
                                                    {downloading === itemKey
                                                        ? t('common.downloading', 'Downloading...')
                                                        : t('transcriptions.downloadTxt', 'Download TXT')}
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(item, 'json')}
                                                    className={styles.secondaryButton}
                                                    disabled={downloading === itemKey}
                                                >
                                                    JSON
                                                </button>
                                                <button
                                                    onClick={() => handleTrigger(item)}
                                                    className={styles.secondaryButton}
                                                    disabled={triggering === itemKey}
                                                    title={t('transcriptions.retranscribeHint', 'Re-scan recordings and transcribe again')}
                                                >
                                                    {triggering === itemKey
                                                        ? t('common.loading', 'Loading...')
                                                        : t('transcriptions.retranscribe', 'Re-transcribe')}
                                                </button>
                                            </>
                                        )}

                                        {(item.transcriptionStatus === 'none' || item.transcriptionStatus === 'failed') && (
                                            <button
                                                onClick={() => handleTrigger(item)}
                                                className={styles.primaryButton}
                                                disabled={triggering === itemKey}
                                            >
                                                {triggering === itemKey
                                                    ? t('common.loading', 'Loading...')
                                                    : t('transcriptions.startTranscription', 'Start Transcription')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

export default Transcriptions;
