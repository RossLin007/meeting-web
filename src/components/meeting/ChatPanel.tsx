// 智会 - 聊天面板组件（优化版，支持富媒体消息）

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '@/types';
import { Modal } from '@/components/common/Modal';
import { PDFPreview } from '@/components/common/PDFPreview';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
    messages: ChatMessage[];
    currentUserId: string;
    userNames?: Record<string, string>;  // 用户名映射
    isConnected: boolean;  // 是否已连接到聊天室
    onSendMessage: (text: string) => void;
    onSendImage?: (file: File) => void;  // 发送图片
    onSendFile?: (file: File) => void;   // 发送文件
    onClose: () => void;
}

// 图标组件
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const SendIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const EmojiIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

const ImageIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
    </svg>
);

const FileIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
    </svg>
);

// 根据名字生成固定颜色
function getAvatarColor(name: string): string {
    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// 头像组件
function Avatar({ name }: { name: string }) {
    const initial = name.charAt(0).toUpperCase();
    const color = getAvatarColor(name);

    return (
        <div className={styles.avatar} style={{ backgroundColor: color }}>
            {initial}
        </div>
    );
}

// 格式化时间
function formatTime(date: Date): string {
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return time;
    } else if (isYesterday) {
        return `昨天 ${time}`;
    } else {
        return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
    }
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 文本文件预览组件
function TextFilePreview({ url }: { url: string }) {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('📎 TextFilePreview 加载文件:', url);
        fetch(url)
            .then(async res => {
                console.log('📎 文件响应状态:', res.status);
                if (!res.ok) throw new Error(`HTTP ${res.status}: 加载失败`);
                return res.text();
            })
            .then(text => {
                console.log('📎 文件内容长度:', text.length);
                setContent(text);
                setLoading(false);
            })
            .catch(err => {
                console.error('📎 文件加载失败:', err);
                setError(`加载失败: ${err.message}`);
                setLoading(false);
            });
    }, [url]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '70vh',
                color: 'var(--color-text-secondary, #666)'
            }}>
                加载中...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '70vh',
                color: 'var(--color-text-secondary, #666)',
                gap: '8px'
            }}>
                <span>{error}</span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)' }}
                >
                    在新窗口打开
                </a>
            </div>
        );
    }

    return (
        <pre style={{
            width: '100%',
            height: '70vh',
            margin: 0,
            padding: '16px',
            overflow: 'auto',
            backgroundColor: 'var(--color-bg-page, #f5f5f5)',
            color: 'var(--color-text-primary, #333)',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
        }}>
            {content}
        </pre>
    );
}

// 根据文件扩展名获取预览内容
function getFilePreviewContent(attachment: NonNullable<ChatMessage['attachment']>, zoom: number = 100) {
    const ext = attachment.name?.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
        return (
            <img
                src={attachment.url}
                alt={attachment.name}
                className={styles.previewImage}
                style={{ transform: `scale(${zoom / 100})` }}
            />
        );
    }

    if (ext === 'pdf') {
        return <PDFPreview url={attachment.url || ''} />;
    }

    // Office 文档使用 Google Docs Viewer
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
        const officeUrl = attachment.url || '';
        const encodedUrl = encodeURIComponent(officeUrl);
        return (
            <div style={{ width: '100%', height: '70vh', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                <iframe
                    src={`https://docs.google.com/gview?embedded=1&url=${encodedUrl}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={attachment.name}
                />
            </div>
        );
    }

    if (['txt', 'md'].includes(ext || '')) {
        return <TextFilePreview url={attachment.url || ''} />;
    }

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                该文件类型无法在线预览
            </p>
            <a
                href={attachment.url}
                download={attachment.name}
                className={styles.downloadButton}
            >
                下载文件
            </a>
        </div>
    );
}

// 富媒体消息渲染组件
function MessageContent({ message, onPreviewImage, onPreviewFile }: {
    message: ChatMessage,
    onPreviewImage?: (url: string) => void,
    onPreviewFile?: (attachment: NonNullable<ChatMessage['attachment']>) => void
}) {
    // 调试日志
    if (message.type === 'image' || message.type === 'file') {
        console.log('🖼️/📎 渲染富媒体消息:', {
            type: message.type,
            content: message.content,
            attachment: message.attachment,
        });
    }

    if (message.type === 'image' && message.attachment?.url) {
        const imageUrl = message.attachment.url;
        return (
            <div className={styles.imageMessage}>
                <img
                    src={imageUrl}
                    alt="发送的图片"
                    className={styles.image}
                    loading="lazy"
                    onClick={() => onPreviewImage?.(imageUrl)}
                />
            </div>
        );
    }

    if (message.type === 'file' && message.attachment?.url) {
        const attachment = message.attachment;
        return (
            <div
                className={styles.fileMessage}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ext = attachment.name?.split('.').pop()?.toLowerCase() || '';
                    const canPreview = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
                    if (canPreview) {
                        onPreviewFile?.(attachment);
                    } else {
                        window.open(attachment.url, '_blank');
                    }
                }}
            >
                <FileIcon />
                <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{attachment.name || '文件'}</div>
                    <div className={styles.fileSize}>{formatFileSize(attachment.size)}</div>
                </div>
            </div>
        );
    }

    // 文本消息：使用 DOMPurify 过滤以防止 XSS 攻击
    const sanitizedContent = DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [] });
    return <>{sanitizedContent}</>;
}

export function ChatPanel({
    messages,
    currentUserId,
    userNames = {},
    isConnected,
    onSendMessage,
    onSendImage,
    onSendFile,
    onClose,
}: ChatPanelProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const lastMessageCount = useRef(0);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 图片和文件预览状态
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<NonNullable<ChatMessage['attachment']> | null>(null);
    const [imageZoom, setImageZoom] = useState(100);
    const [fileZoom, setFileZoom] = useState(100);

    // 预览图片
    const handlePreviewImage = useCallback((url: string) => {
        setPreviewImage(url);
        setImageZoom(100);
    }, []);

    // 预览文件
    const handlePreviewFile = useCallback((attachment: NonNullable<ChatMessage['attachment']>) => {
        setPreviewFile(attachment);
        setFileZoom(100);
    }, []);

    // 关闭图片预览
    const closeImagePreview = useCallback(() => {
        setPreviewImage(null);
        setImageZoom(100);
    }, []);

    // 关闭文件预览
    const closeFilePreview = useCallback(() => {
        setPreviewFile(null);
        setFileZoom(100);
    }, []);

    // 放大图片
    const handleZoomIn = useCallback(() => {
        setImageZoom(prev => Math.min(prev + 25, 500));
    }, []);

    // 缩小图片
    const handleZoomOut = useCallback(() => {
        setImageZoom(prev => Math.max(prev - 25, 25));
    }, []);

    // 重置缩放
    const handleZoomReset = useCallback(() => {
        setImageZoom(100);
    }, []);

    // 放大文件
    const handleFileZoomIn = useCallback(() => {
        setFileZoom(prev => Math.min(prev + 25, 500));
    }, []);

    // 缩小文件
    const handleFileZoomOut = useCallback(() => {
        setFileZoom(prev => Math.max(prev - 25, 25));
    }, []);

    // 重置文件缩放
    const handleFileZoomReset = useCallback(() => {
        setFileZoom(100);
    }, []);

    // 调试：打印最近的消息数据
    useEffect(() => {
        if (messages.length > 0) {
            const latestMsg = messages[messages.length - 1];
            console.log('💬 最新消息详情:', {
                id: latestMsg.id,
                type: latestMsg.type,
                content: latestMsg.content,
                attachment: latestMsg.attachment,
                fullMessage: latestMsg,
            });
        }
    }, [messages]);

    // 常用表情
    const emojis = ['😀', '😂', '🥰', '😎', '🤔', '👍', '👏', '🎉', '❤️', '🔥', '✨', '💪'];

    // 滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollButton(false);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 检测是否滚动到底部
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

            // 如果不在底部且有新消息，显示滚动按钮
            if (!isAtBottom && messages.length > lastMessageCount.current) {
                setShowScrollButton(true);
            } else if (isAtBottom) {
                setShowScrollButton(false);
            }
        };

        container.addEventListener('scroll', handleScroll);

        // 检测新消息
        if (messages.length > lastMessageCount.current) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (!isAtBottom) {
                setShowScrollButton(true);
            }
        }

        lastMessageCount.current = messages.length;

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        onSendMessage(inputValue.trim());
        setInputValue('');
        setShowEmoji(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEmojiClick = (emoji: string) => {
        setInputValue((prev) => prev + emoji);
    };

    const handleImageClick = () => {
        imageInputRef.current?.click();
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onSendImage) {
            onSendImage(file);
        }
        // 重置 input
        e.target.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onSendFile) {
            onSendFile(file);
        }
        // 重置 input
        e.target.value = '';
    };

    return (
        <div className={styles.container}>
            {/* 头部 */}
            <div className={styles.header}>
                <h3 className={styles.title}>{t('chat.title')}</h3>
                <button className={styles.closeBtn} onClick={onClose}>
                    <CloseIcon />
                </button>
            </div>

            {/* 消息列表 */}
            <div className={styles.messages} ref={messagesContainerRef}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>{t('chat.noMessages')}</div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.senderId === currentUserId;
                        // 获取显示名称：优先使用 userNames，然后是 senderName，最后截取 ID
                        const displayName = userNames[msg.senderId] ||
                            (msg.senderName !== msg.senderId ? msg.senderName : '') ||
                            msg.senderId.substring(0, 8);
                        return (
                            <div
                                key={msg.id}
                                className={clsx(styles.message, isOwn && styles.ownMessage)}
                            >
                                {!isOwn && <Avatar name={displayName} />}
                                <div className={styles.messageContent}>
                                    {!isOwn && (
                                        <div className={styles.messageHeader}>
                                            <span className={styles.senderName}>{displayName}</span>
                                            <span className={styles.timestamp}>{formatTime(msg.timestamp)}</span>
                                        </div>
                                    )}
                                    <div
                                        className={clsx(styles.bubble, isOwn && styles.ownBubble, msg.type === 'image' && styles.imageBubble)}
                                        onClick={(e) => {
                                            if (msg.type === 'file') {
                                                e.stopPropagation();
                                            }
                                        }}
                                    >
                                        <MessageContent
                                            message={msg}
                                            onPreviewImage={handlePreviewImage}
                                            onPreviewFile={handlePreviewFile}
                                        />
                                    </div>
                                    {isOwn && (
                                        <div className={styles.messageFooter}>
                                            <span className={styles.timestamp}>{formatTime(msg.timestamp)}</span>
                                        </div>
                                    )}
                                </div>
                                {isOwn && <Avatar name={displayName} />}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 滚动到新消息按钮 */}
            {showScrollButton && (
                <button
                    className={styles.scrollButton}
                    onClick={scrollToBottom}
                    title="新消息"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                    <span>新消息</span>
                </button>
            )}

            {/* 表情选择器 */}
            {showEmoji && (
                <div className={styles.emojiPicker}>
                    {emojis.map((emoji) => (
                        <button
                            key={emoji}
                            className={styles.emojiBtn}
                            onClick={() => handleEmojiClick(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* 输入区域 */}
            <div className={styles.inputArea}>
                <button
                    className={clsx(styles.emojiToggle, showEmoji && styles.active)}
                    onClick={() => setShowEmoji(!showEmoji)}
                    disabled={!isConnected}
                    title="表情"
                >
                    <EmojiIcon />
                </button>
                <button
                    className={styles.fileActionBtn}
                    onClick={handleImageClick}
                    disabled={!isConnected}
                    title="发送图片"
                >
                    <ImageIcon />
                </button>
                <button
                    className={styles.fileActionBtn}
                    onClick={handleFileClick}
                    disabled={!isConnected}
                    title="发送文件"
                >
                    <FileIcon />
                </button>
                <input
                    type="text"
                    className={styles.input}
                    placeholder={isConnected ? t('chat.placeholder') : '连接中...'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isConnected}
                />
                <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={!inputValue.trim() || !isConnected}
                >
                    <SendIcon />
                </button>
            </div>

            {/* 隐藏的文件输入 */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
            />
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {/* 连接状态提示 */}
            {!isConnected && (
                <div className={styles.connectingStatus}>
                    <span>⏳ 正在连接聊天室...</span>
                </div>
            )}

            {/* 图片预览模态框 */}
            <Modal
                isOpen={!!previewImage}
                onClose={closeImagePreview}
                size="xl"
                showHeader={false}
                closeOnOverlayClick={true}
                closeOnEsc={true}
            >
                <div className={styles.imagePreviewWrapper}>
                    <div className={styles.imagePreviewToolbar}>
                        <button
                            className={styles.zoomButton}
                            onClick={handleZoomOut}
                            title="缩小"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                        </button>
                        <span className={styles.zoomLevel}>{imageZoom}%</span>
                        <button
                            className={styles.zoomButton}
                            onClick={handleZoomIn}
                            title="放大"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="11" y1="8" x2="11" y2="14" />
                                <line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                        </button>
                        <button
                            className={styles.zoomButton}
                            onClick={handleZoomReset}
                            title="重置"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                            </svg>
                        </button>
                    </div>
                    <div className={styles.imagePreviewContainer}>
                        <img
                            src={previewImage || ''}
                            alt="预览"
                            className={styles.previewImage}
                            style={{ transform: `scale(${imageZoom / 100})` }}
                        />
                    </div>
                </div>
            </Modal>

            {/* 文件预览模态框 */}
            <Modal
                isOpen={!!previewFile}
                onClose={closeFilePreview}
                size="lg"
                title={previewFile?.name || '文件预览'}
                showCloseButton={true}
            >
                {previewFile && (
                    <div className={styles.filePreviewWrapper}>
                        <div className={styles.imagePreviewToolbar}>
                            <button
                                className={styles.zoomButton}
                                onClick={handleFileZoomOut}
                                title="缩小"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                            <span className={styles.zoomLevel}>{fileZoom}%</span>
                            <button
                                className={styles.zoomButton}
                                onClick={handleFileZoomIn}
                                title="放大"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="11" y1="8" x2="11" y2="14" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                            <button
                                className={styles.zoomButton}
                                onClick={handleFileZoomReset}
                                title="重置"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                </svg>
                            </button>
                        </div>
                        <div className={styles.filePreviewContainer}>
                            {getFilePreviewContent(previewFile, fileZoom)}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default ChatPanel;
