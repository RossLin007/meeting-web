// 智会 - 录制文件管理页面

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import styles from './Recordings.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Recording {
    id: string;
    taskId: string;
    startedBy: string;
    startedAt: number;
    endedAt: number | null;
    duration: number | null;
    status: string;
    visibility: string;
    fileUrl: string | null;
    title: string | null;
    meetingTitle?: string;
}

// 图标组件
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const BackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const VideoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
);

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

export function Recordings() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const { user } = useAuth();

    const meetingId = searchParams.get('meetingId');

    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 加载录制列表
    const loadRecordings = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const url = meetingId
                ? `${API_URL}/api/recording/list/${meetingId}?userId=${user.id}`
                : `${API_URL}/api/recording/list/all?userId=${user.id}`;

            const response = await fetchWithTimeout(url, {}, 30000);
            const result = await response.json();

            if (result.success) {
                setRecordings(result.data || []);
                setIsHost(result.isHost || false);
            } else {
                setError(result.error || 'Failed to load recordings');
            }
        } catch (err) {
            console.error('Failed to load recordings:', err);
            setError('Failed to load recordings');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, meetingId]);

    useEffect(() => {
        loadRecordings();
    }, [loadRecordings]);

    // 格式化时长
    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 格式化日期
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 播放录制
    const handlePlay = (recording: Recording) => {
        if (recording.fileUrl) {
            setSelectedRecording(recording);
        }
    };

    // 下载录制
    const handleDownload = (recording: Recording) => {
        if (recording.fileUrl) {
            window.open(recording.fileUrl, '_blank');
        }
    };

    // 获取状态标签样式
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'recording':
                return styles.statusRecording;
            case 'completed':
                return styles.statusCompleted;
            case 'failed':
                return styles.statusFailed;
            default:
                return '';
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    <BackIcon />
                </button>
                <h1 className={styles.title}>{t('recordings.pageTitle')}</h1>
                <button
                    className={styles.refreshBtn}
                    onClick={loadRecordings}
                    disabled={isLoading}
                    title={t('common.refresh') || '刷新'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isLoading ? styles.spinning : ''}>
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                </button>
            </header>

            <main className={styles.main}>
                {isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <span>{t('common.loading')}</span>
                    </div>
                ) : error ? (
                    <div className={styles.empty}>
                        <VideoIcon />
                        <h3>{error}</h3>
                        <button onClick={loadRecordings}>{t('common.retry')}</button>
                    </div>
                ) : recordings.length === 0 ? (
                    <div className={styles.empty}>
                        <VideoIcon />
                        <h3>{t('recordings.noRecordings')}</h3>
                        <p>{t('recordings.noRecordingsDesc')}</p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {recordings.map((recording) => (
                            <div key={recording.id} className={styles.card}>
                                <div
                                    className={styles.thumbnail}
                                    onClick={() => handlePlay(recording)}
                                >
                                    <VideoIcon />
                                    {recording.fileUrl && (
                                        <div className={styles.playOverlay}>
                                            <PlayIcon />
                                        </div>
                                    )}
                                    <span className={styles.duration}>
                                        {formatDuration(recording.duration)}
                                    </span>
                                    <span className={`${styles.statusBadge} ${getStatusClass(recording.status)}`}>
                                        {t(`recordings.status.${recording.status}`)}
                                    </span>
                                </div>

                                <div className={styles.info}>
                                    <h3 className={styles.recordingTitle}>
                                        {recording.title || t('recordings.title')}
                                    </h3>
                                    <div className={styles.meta}>
                                        <span>{formatDate(recording.startedAt)}</span>
                                        <span className={styles.visibilityBadge}>
                                            {recording.visibility === 'all' ? (
                                                <><EyeIcon /> {t('recordings.visibility.all')}</>
                                            ) : (
                                                <><LockIcon /> {t('recordings.visibility.hostOnly')}</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.actions}>
                                    {recording.fileUrl && (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleDownload(recording)}
                                            title={t('recordings.downloadRecording')}
                                        >
                                            <DownloadIcon />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {selectedRecording && selectedRecording.fileUrl && (
                <div
                    className={styles.playerOverlay}
                    onClick={() => setSelectedRecording(null)}
                >
                    <div
                        className={styles.player}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3>{selectedRecording.title || t('recordings.title')}</h3>
                        <video
                            src={selectedRecording.fileUrl}
                            controls
                            autoPlay
                            className={styles.video}
                        />
                        <button
                            className={styles.closePlayer}
                            onClick={() => setSelectedRecording(null)}
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Recordings;
