// 智会 - 录制文件管理页面

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { TranscriptionPanel } from '@/components/TranscriptionPanel';
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

const TranscriptIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
);

const MergeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6L5 8L3 10" />
        <path d="M3 12h2" />
        <path d="M3 18L5 20L3 22" />
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
    const [videoError, setVideoError] = useState<string | null>(null);
    const [transcriptionRecording, setTranscriptionRecording] = useState<Recording | null>(null);
    const [mergedTranscription, setMergedTranscription] = useState<{
        fullText: string;
        segmentCount: number;
        recordingCount: number;
    } | null>(null);
    const [isMerging, setIsMerging] = useState(false);

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

    // 加载合并转录
    const loadMergedTranscription = useCallback(async () => {
        if (!meetingId) {
            alert(t('recordings.selectMeetingFirst'));
            return;
        }

        setIsMerging(true);
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/transcription/merge/${meetingId}`,
                {},
                60000
            );
            const result = await response.json();

            if (result.success) {
                setMergedTranscription({
                    fullText: result.fullText,
                    segmentCount: result.segmentCount,
                    recordingCount: result.recordingCount,
                });
            } else {
                alert(result.error || t('transcription.mergeFailed'));
            }
        } catch (err) {
            console.error('Failed to load merged transcription:', err);
            alert(t('transcription.mergeFailed'));
        } finally {
            setIsMerging(false);
        }
    }, [meetingId, t]);

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
            setVideoError(null);
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
                {meetingId && (
                    <button
                        className={styles.mergeBtn}
                        onClick={loadMergedTranscription}
                        disabled={isMerging}
                        title={t('transcription.viewMerged') || '查看合并转录'}
                    >
                        {isMerging ? (
                            <span className={styles.spinner} />
                        ) : (
                            <MergeIcon />
                        )}
                        <span>{t('transcription.viewMerged') || '合并转录'}</span>
                    </button>
                )}
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
                                    {recording.status === 'completed' && (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => setTranscriptionRecording(recording)}
                                            title={t('transcription.title')}
                                        >
                                            <TranscriptIcon />
                                        </button>
                                    )}
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
                    onClick={() => {
                        setVideoError(null);
                        setSelectedRecording(null);
                    }}
                >
                    <div
                        className={styles.player}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3>{selectedRecording.title || t('recordings.title')}</h3>
                        {videoError ? (
                            <div
                                className={styles.videoError}
                                role="alert"
                                aria-live="assertive"
                                id="video-error-desc"
                            >
                                <p>{videoError}</p>
                                <button
                                    className={styles.errorBtn}
                                    onClick={() => selectedRecording.fileUrl && window.open(selectedRecording.fileUrl, '_blank')}
                                >
                                    {t('recordings.openInNewTab')}
                                </button>
                            </div>
                        ) : (
                            <video
                                data-testid="video-player"
                                src={selectedRecording.fileUrl}
                                controls
                                autoPlay
                                className={styles.video}
                                aria-label={t('recordings.title')}
                                aria-describedby={videoError ? 'video-error-desc' : undefined}
                                onError={(e) => {
                                    console.error('Video playback error:', e);
                                    setVideoError(t('recordings.videoError'));
                                }}
                            />
                        )}
                        <button
                            className={styles.closePlayer}
                            onClick={() => {
                                setVideoError(null);
                                setSelectedRecording(null);
                            }}
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}

            {/* 转录面板模态框 */}
            {transcriptionRecording && (
                <div
                    className={styles.playerOverlay}
                    onClick={() => setTranscriptionRecording(null)}
                >
                    <div
                        className={styles.transcriptionModal}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={styles.transcriptionHeader}>
                            <h3>{transcriptionRecording.title || t('recordings.title')}</h3>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setTranscriptionRecording(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <TranscriptionPanel
                            recordingId={transcriptionRecording.id}
                            onSeek={(timeMs) => {
                                // 如果需要，可以同时打开视频并跳转
                                console.log('Seek to:', timeMs);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* 合并转录模态框 */}
            {mergedTranscription && (
                <div
                    className={styles.playerOverlay}
                    onClick={() => setMergedTranscription(null)}
                >
                    <div
                        className={styles.transcriptionModal}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={styles.transcriptionHeader}>
                            <h3>{t('transcription.mergedTitle') || '会议完整转录'}</h3>
                            <div className={styles.mergeStats}>
                                <span>{mergedTranscription.recordingCount} {t('transcription.recordings') || '个录制'}</span>
                                <span>{mergedTranscription.segmentCount} {t('transcription.segments') || '个片段'}</span>
                            </div>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setMergedTranscription(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className={styles.mergedContent}>
                            <pre className={styles.mergedText}>
                                {mergedTranscription.fullText || t('transcription.noContent')}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Recordings;
