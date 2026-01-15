// 智会 - 我的录制（存储管理）

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import styles from './MyRecordings.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface FileInfo {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    url?: string;
}

interface StorageStats {
    usedBytes: number;
    usedGB: string;
    totalGB: number;
    fileCount: number;
    usagePercent: number;
}

// 图标组件
const BackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const DeleteIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

export function MyRecordings() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [stats, setStats] = useState<StorageStats | null>(null);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [renameFile, setRenameFile] = useState<FileInfo | null>(null);
    const [newFileName, setNewFileName] = useState('');

    // 加载存储统计和文件列表
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 并行加载统计和文件列表
            const [statsRes, filesRes] = await Promise.all([
                fetchWithTimeout(`${API_URL}/api/storage/stats`, {}, 30000),
                fetchWithTimeout(`${API_URL}/api/storage/files`, {}, 30000),
            ]);

            const statsResult = await statsRes.json();
            const filesResult = await filesRes.json();

            if (statsResult.success) {
                setStats(statsResult.data);
            }

            if (filesResult.success) {
                setFiles(filesResult.data || []);
            }
        } catch (err) {
            console.error('Failed to load storage data:', err);
            setError('加载失败，请重试');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 格式化文件大小
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // 格式化日期
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    // 下载文件
    const handleDownload = (file: FileInfo) => {
        if (file.url) {
            window.open(file.url, '_blank');
        }
    };

    // 删除文件
    const handleDelete = async (file: FileInfo) => {
        if (!window.confirm(`确定要删除 "${file.name}" 吗？此操作不可恢复。`)) {
            return;
        }

        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/storage/files/${file.key}`,
                { method: 'DELETE' },
                30000
            );
            const result = await response.json();

            if (result.success) {
                await loadData(); // 重新加载数据
            } else {
                alert('删除失败：' + result.error);
            }
        } catch (err) {
            console.error('Delete file error:', err);
            alert('删除失败');
        }
    };

    // 打开重命名对话框
    const openRename = (file: FileInfo) => {
        setRenameFile(file);
        // 移除扩展名，只编辑文件名
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setNewFileName(nameWithoutExt);
    };

    // 执行重命名
    const handleRename = async () => {
        if (!renameFile || !newFileName.trim()) return;

        // 保留原扩展名
        const ext = renameFile.name.substring(renameFile.name.lastIndexOf('.'));
        const fullNewName = newFileName.trim() + ext;

        try {
            const response = await fetchWithTimeout(
                `${API_URL}/api/storage/files/rename`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: renameFile.key,
                        newName: fullNewName,
                    }),
                },
                30000
            );
            const result = await response.json();

            if (result.success) {
                setRenameFile(null);
                await loadData();
            } else {
                alert('重命名失败：' + result.error);
            }
        } catch (err) {
            console.error('Rename file error:', err);
            alert('重命名失败');
        }
    };

    return (
        <div className={styles.container}>
            {/* 头部 */}
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    <BackIcon />
                </button>
                <h1 className={styles.title}>我的录制</h1>
                <button
                    className={styles.refreshBtn}
                    onClick={loadData}
                    disabled={isLoading}
                    title="刷新"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isLoading ? styles.spinning : ''}>
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                </button>
            </header>

            {/* 存储统计 */}
            {stats && (
                <div className={styles.statsCard}>
                    <h2>存储空间</h2>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${stats.usagePercent}%` }}
                        />
                    </div>
                    <div className={styles.statsInfo}>
                        <span className={styles.usage}>
                            {stats.usedGB} GB / {stats.totalGB}.00 GB
                        </span>
                        <span className={styles.fileCount}>
                            共 {stats.fileCount} 个文件
                        </span>
                    </div>
                </div>
            )}

            {/* 文件列表 */}
            <main className={styles.main}>
                {isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <span>加载中...</span>
                    </div>
                ) : error ? (
                    <div className={styles.empty}>
                        <h3>{error}</h3>
                        <button onClick={loadData}>重试</button>
                    </div>
                ) : files.length === 0 ? (
                    <div className={styles.empty}>
                        <h3>暂无录制文件</h3>
                        <p>开始录制会议后，文件将显示在这里</p>
                    </div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>文件名</th>
                                    <th>创建时间</th>
                                    <th>文件大小</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map((file) => (
                                    <tr key={file.key}>
                                        <td className={styles.fileName}>{file.name}</td>
                                        <td>{formatDate(file.lastModified)}</td>
                                        <td>{formatSize(file.size)}</td>
                                        <td className={styles.actions}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => handleDownload(file)}
                                                title="导出"
                                            >
                                                <DownloadIcon />
                                            </button>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => openRename(file)}
                                                title="重命名"
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                className={`${styles.actionBtn} ${styles.danger}`}
                                                onClick={() => handleDelete(file)}
                                                title="删除"
                                            >
                                                <DeleteIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* 重命名对话框 */}
            {renameFile && (
                <div className={styles.modal} onClick={() => setRenameFile(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>重命名文件</h3>
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder="输入新文件名"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') setRenameFile(null);
                            }}
                        />
                        <div className={styles.modalActions}>
                            <button onClick={() => setRenameFile(null)}>
                                取消
                            </button>
                            <button
                                className={styles.primary}
                                onClick={handleRename}
                                disabled={!newFileName.trim()}
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyRecordings;
