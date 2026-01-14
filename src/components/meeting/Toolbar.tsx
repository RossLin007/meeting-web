// 智会 - 底部工具栏组件

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './Toolbar.module.css';

// 图标组件
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const CameraOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </svg>
);

const ScreenShareIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
);

const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 14h4v4M20 10h-4V6M14 10h6M4 10h6M14 14h4v4M10 14H4v-4" />
    </svg>
);

const UsersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ChatIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const EndCallIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22.5 15.5H1.5C1.5 9.15 6.65 4 13 4C19.35 4 24.5 9.15 24.5 15.5H22.5Z" transform="rotate(135 12 12)" />
    </svg>
);

const InviteIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
);

const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

// 录制图标
const RecordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <circle cx="12" cy="12" r="8" />
    </svg>
);

const RecordingIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <circle cx="12" cy="12" r="8" opacity="1">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
    </svg>
);

// 布局图标
const LayoutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
);

interface ToolbarProps {
    isMicOn: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    isFullscreen: boolean;
    showChat: boolean;
    showMembers: boolean;
    memberCount: number;
    unreadCount?: number;  // 未读消息数
    // 录制相关
    isRecording: boolean;
    isRoomRecording: boolean;  // 房间是否正在录制（其他人录制时也显示）
    recordingTime: number;
    canRecord: boolean;  // 是否有权限录制（主持人/联席主持人）
    onToggleMic: () => void;
    onToggleCamera: () => void;
    onToggleScreenShare: () => void;
    onToggleFullscreen: () => void;
    onToggleChat: () => void;
    onToggleMembers: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onInvite: () => void;
    onSettings: () => void;
    onLeaveMeeting: () => void;
    onLayoutClick?: () => void;  // 布局切换
}

function ToolbarComponent({
    isMicOn,
    isCameraOn,
    isScreenSharing,
    isFullscreen,
    showChat,
    showMembers,
    memberCount,
    unreadCount = 0,
    isRecording,
    isRoomRecording,
    recordingTime,
    canRecord,
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
    onToggleFullscreen,
    onToggleChat,
    onToggleMembers,
    onStartRecording,
    onStopRecording,
    onInvite,
    onSettings,
    onLeaveMeeting,
    onLayoutClick,
}: ToolbarProps) {
    const { t } = useTranslation();

    // 格式化录制时间
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftSection}>
                {/* 麦克风 */}
                <button
                    className={clsx(styles.button, !isMicOn && styles.off)}
                    onClick={onToggleMic}
                    title={isMicOn ? t('meeting.muteMic') : t('meeting.unmuteMic')}
                >
                    {isMicOn ? <MicIcon /> : <MicOffIcon />}
                    <span className={styles.label}>
                        {isMicOn ? t('meeting.muteMic') : t('meeting.unmuteMic')}
                    </span>
                </button>

                {/* 摄像头 */}
                <button
                    className={clsx(styles.button, !isCameraOn && styles.off)}
                    onClick={onToggleCamera}
                    title={isCameraOn ? t('meeting.turnOffCamera') : t('meeting.turnOnCamera')}
                >
                    {isCameraOn ? <CameraIcon /> : <CameraOffIcon />}
                    <span className={styles.label}>
                        {isCameraOn ? t('meeting.turnOffCamera') : t('meeting.turnOnCamera')}
                    </span>
                </button>
            </div>

            <div className={styles.centerSection}>
                {/* 屏幕共享 */}
                <button
                    className={clsx(styles.button, isScreenSharing && styles.active)}
                    onClick={onToggleScreenShare}
                    title={isScreenSharing ? t('meeting.stopShare') : t('meeting.shareScreen')}
                >
                    <ScreenShareIcon />
                    <span className={styles.label}>
                        {isScreenSharing ? t('meeting.stopShare') : t('meeting.shareScreen')}
                    </span>
                </button>

                {/* 全屏 */}
                <button
                    className={styles.button}
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? t('meeting.exitFullscreen') : t('meeting.fullscreen')}
                >
                    {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                    <span className={styles.label}>
                        {isFullscreen ? t('meeting.exitFullscreen') : t('meeting.fullscreen')}
                    </span>
                </button>

                {/* 成员 */}
                <button
                    className={clsx(styles.button, showMembers && styles.active)}
                    onClick={onToggleMembers}
                    title={t('meeting.members')}
                >
                    <UsersIcon />
                    <span className={styles.label}>
                        {t('meeting.members')} ({memberCount})
                    </span>
                </button>

                {/* 聊天 */}
                <button
                    className={clsx(styles.button, showChat && styles.active)}
                    onClick={onToggleChat}
                    title={t('meeting.chat')}
                >
                    <span className={styles.iconWrapper}>
                        <ChatIcon />
                        {unreadCount > 0 && !showChat && (
                            <span className={styles.badge}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </span>
                    <span className={styles.label}>{t('meeting.chat')}</span>
                </button>

                {/* 录制 - 只有主持人/联席主持人可见 */}
                {canRecord && (
                    <button
                        className={clsx(
                            styles.button,
                            (isRecording || isRoomRecording) && styles.recording
                        )}
                        onClick={isRecording ? onStopRecording : onStartRecording}
                        title={isRecording || isRoomRecording
                            ? t('recording.stop')
                            : t('recording.start')
                        }
                    >
                        <span className={clsx(styles.iconWrapper, styles.recordIcon)}>
                            {(isRecording || isRoomRecording) ? <RecordingIcon /> : <RecordIcon />}
                        </span>
                        <span className={styles.label}>
                            {(isRecording || isRoomRecording)
                                ? formatTime(recordingTime)
                                : t('recording.start')
                            }
                        </span>
                    </button>
                )}

                {/* 邀请 */}
                <button
                    className={styles.button}
                    onClick={onInvite}
                    title={t('invite.title')}
                >
                    <InviteIcon />
                    <span className={styles.label}>{t('meeting.invite')}</span>
                </button>

                {/* 布局 */}
                {onLayoutClick && (
                    <button
                        className={styles.button}
                        onClick={onLayoutClick}
                        title={t('layout.title')}
                    >
                        <LayoutIcon />
                        <span className={styles.label}>{t('layout.title')}</span>
                    </button>
                )}

                {/* 设置 */}
                <button
                    className={styles.button}
                    onClick={onSettings}
                    title={t('settings.title')}
                >
                    <SettingsIcon />
                    <span className={styles.label}>{t('settings.title')}</span>
                </button>
            </div>

            <div className={styles.rightSection}>
                {/* 结束会议 */}
                <button
                    className={clsx(styles.button, styles.endCall)}
                    onClick={onLeaveMeeting}
                    title={t('meeting.endMeeting')}
                >
                    <EndCallIcon />
                    <span className={styles.label}>{t('meeting.endMeeting')}</span>
                </button>
            </div>
        </div>
    );
}

// 使用 React.memo 优化性能
export const Toolbar = memo(ToolbarComponent);

export default Toolbar;
