// 智会 - 我的录制视图组件

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input } from '@/components/common';
import { FilmIcon } from '@/components/icons';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import Hls from 'hls.js';
import styles from '@/pages/Home.module.css';

const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface StorageStats {
    usedGB: string;
    totalGB: number;
    fileCount: number;
    usagePercent: number;
}

interface StorageFile {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    url?: string;
}

export function RecordingsView() {
    const { t } = useTranslation();

    // Storage state
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
    const [storageLoading, setStorageLoading] = useState(false);
    const [renameFile, setRenameFile] = useState<{ key: string; name: string } | null>(null);
    const [newFileName, setNewFileName] = useState('');
    const [selectedFile, setSelectedFile] = useState<{ key: string; name: string; url: string } | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load storage data
    const loadStorageData = useCallback(async () => {
        setStorageLoading(true);
        try {
            const [statsRes, filesRes] = await Promise.all([
                fetchWithTimeout(`${API_BASE_URL}/api/storage/stats`, {}, DEFAULT_TIMEOUT),
                fetchWithTimeout(`${API_BASE_URL}/api/storage/files`, {}, DEFAULT_TIMEOUT),
            ]);
            const statsResult = await statsRes.json();
            const filesResult = await filesRes.json();
            if (statsResult.success) setStorageStats(statsResult.data);
            if (filesResult.success) setStorageFiles(filesResult.data || []);
        } catch (error) {
            console.error('加载存储数据失败:', error);
        } finally {
            setStorageLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStorageData();
    }, [loadStorageData]);

    // Initialize HLS.js player
    useEffect(() => {
        if (!selectedFile || !selectedFile.url || !videoRef.current) return;

        const video = videoRef.current;
        const videoSrc = selectedFile.url;

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoSrc;
        } else if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
            });
            hls.loadSource(videoSrc);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.log('播放失败:', e));
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                console.error('HLS 错误:', data);
            });

            return () => {
                hls.destroy();
            };
        } else {
            console.error('此浏览器不支持 HLS 播放');
        }
    }, [selectedFile]);

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format storage date
    const formatStorageDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    // Delete file
    const handleDeleteFile = async (file: { key: string; name: string }) => {
        if (!window.confirm(`确定要删除 "${file.name}" 吗？此操作不可恢复。`)) return;
        try {
            const response = await fetchWithTimeout(
                `${API_BASE_URL}/api/storage/files/${file.key}`,
                { method: 'DELETE' },
                DEFAULT_TIMEOUT
            );
            const result = await response.json();
            if (result.success) await loadStorageData();
            else alert('删除失败：' + result.error);
        } catch (error) {
            console.error('删除文件失败:', error);
            alert('删除失败');
        }
    };

    // Open rename dialog
    const openRenameDialog = (file: { key: string; name: string }) => {
        setRenameFile(file);
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setNewFileName(nameWithoutExt);
    };

    // Execute rename
    const handleRenameFile = async () => {
        if (!renameFile || !newFileName.trim()) return;
        const ext = renameFile.name.substring(renameFile.name.lastIndexOf('.'));
        const fullNewName = newFileName.trim() + ext;
        try {
            const response = await fetchWithTimeout(
                `${API_BASE_URL}/api/storage/files/rename`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: renameFile.key, newName: fullNewName }),
                },
                DEFAULT_TIMEOUT
            );
            const result = await response.json();
            if (result.success) {
                setRenameFile(null);
                await loadStorageData();
            } else {
                alert('重命名失败：' + result.error);
            }
        } catch (error) {
            console.error('重命名失败:', error);
            alert('重命名失败');
        }
    };

    // Play file
    const handlePlayFile = (file: { key: string; name: string; url?: string }) => {
        if (file.url && file.name.endsWith('.m3u8')) {
            setSelectedFile({ key: file.key, name: file.name, url: file.url });
        }
    };

    return (
        <>
            {/* Storage stats card */}
            {storageStats && (
                <div className={styles.storageStatsCard}>
                    <h2 className={styles.storageTitle}>{t('home.storageSpace')}</h2>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${storageStats.usagePercent}%` }}
                        />
                    </div>
                    <div className={styles.storageInfo}>
                        <span className={styles.storageUsage}>
                            {storageStats.usedGB} GB / {storageStats.totalGB}.00 GB
                        </span>
                        <span className={styles.storageFileCount}>
                            {t('home.totalFiles', { count: storageStats.fileCount })}
                        </span>
                    </div>
                </div>
            )}

            {/* File list */}
            <section className={styles.storageSection}>
                {storageLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <span>{t('common.loading')}</span>
                    </div>
                ) : storageFiles.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FilmIcon />
                        <h3>{t('home.noRecordingFiles')}</h3>
                        <p>{t('home.recordingHint')}</p>
                    </div>
                ) : (
                    <div className={styles.storageTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('home.fileName')}</th>
                                    <th>{t('home.createdAt')}</th>
                                    <th>{t('home.fileSize')}</th>
                                    <th>{t('home.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {storageFiles.map((file) => (
                                    <tr key={file.key}>
                                        <td className={styles.fileName}>{file.name}</td>
                                        <td>{formatStorageDate(file.lastModified)}</td>
                                        <td>{formatFileSize(file.size)}</td>
                                        <td className={styles.fileActions}>
                                            {/* Play button - only for .m3u8 files */}
                                            {file.url && file.name.endsWith('.m3u8') && (
                                                <button
                                                    className={styles.fileActionBtn}
                                                    onClick={() => handlePlayFile(file)}
                                                    title={t('home.play')}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </button>
                                            )}
                                            {/* Export button */}
                                            {file.url && (
                                                <button
                                                    className={styles.fileActionBtn}
                                                    onClick={() => window.open(file.url, '_blank')}
                                                    title={t('home.export')}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                        <polyline points="7 10 12 15 17 10" />
                                                        <line x1="12" y1="15" x2="12" y2="3" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                className={styles.fileActionBtn}
                                                onClick={() => openRenameDialog(file)}
                                                title={t('home.rename')}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                            <button
                                                className={`${styles.fileActionBtn} ${styles.danger}`}
                                                onClick={() => handleDeleteFile(file)}
                                                title={t('common.delete')}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Rename file modal */}
            {renameFile && (
                <Modal
                    isOpen={true}
                    onClose={() => setRenameFile(null)}
                    title={t('home.renameFile')}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setRenameFile(null)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleRenameFile} disabled={!newFileName.trim()}>
                                {t('common.confirm')}
                            </Button>
                        </>
                    }
                >
                    <div className={styles.form}>
                        <Input
                            label={t('home.fileName')}
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder={t('home.newFileName')}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newFileName.trim()) handleRenameFile();
                                if (e.key === 'Escape') setRenameFile(null);
                            }}
                        />
                    </div>
                </Modal>
            )}

            {/* Video player modal */}
            {selectedFile && selectedFile.url && (
                <div
                    className={styles.playerOverlay}
                    onClick={() => setSelectedFile(null)}
                >
                    <div
                        className={styles.player}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>{selectedFile.name}</h3>
                        <video
                            ref={videoRef}
                            controls
                            className={styles.video}
                        />
                        <Button onClick={() => setSelectedFile(null)}>
                            {t('home.closePlayer')}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

export default RecordingsView;
