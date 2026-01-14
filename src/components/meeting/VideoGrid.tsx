// 智会 - 视频宫格组件

import { type RefObject, memo } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './VideoGrid.module.css';
import type { LayoutType } from './LayoutSelector';

// 麦克风开启图标
const MicOnIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
);

// 麦克风静音图标
const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
);

interface VideoGridProps {
    localVideoRef: RefObject<HTMLDivElement | null>;
    screenShareRef?: RefObject<HTMLDivElement | null>;
    remoteUsers: string[];
    remoteUserNames?: Record<string, string>;
    memberAudioStates?: Record<string, boolean>;  // 成员音频状态
    currentUserId: string;
    currentUserName?: string;
    isCameraOn: boolean;
    isMicOn?: boolean;  // 本地麦克风状态
    isScreenSharing: boolean;
    screenShareUserId: string | null;
    layout?: LayoutType;  // 布局类型
}

function VideoGridComponent({
    localVideoRef,
    screenShareRef,
    remoteUsers,
    remoteUserNames = {},
    memberAudioStates = {},
    currentUserId,
    currentUserName,
    isCameraOn: _isCameraOn, // 用于 memo 比较，不在组件内直接使用
    isMicOn = true,
    isScreenSharing,
    screenShareUserId,
    layout = 'gallery',
}: VideoGridProps) {
    const { t } = useTranslation();

    // 是否有人在共享屏幕（本地或远程）
    const hasScreenShare = isScreenSharing || screenShareUserId !== null;
    const totalUsers = remoteUsers.length + 1;

    // 计算宫格布局
    const getGridClass = () => {
        // 屏幕共享时使用固定布局
        if (hasScreenShare) return styles.gridScreenShare;

        // 根据布局类型选择样式
        switch (layout) {
            case 'speaker':
                return styles.layoutSpeaker;
            case 'focus':
                return styles.layoutFocus;
            case 'sideBySide':
                return styles.layoutSideBySide;
            case 'float':
                return styles.layoutFloat;
            case 'gallery':
            default:
                // 画廊布局（默认）
                if (totalUsers === 1) return styles.grid1;
                if (totalUsers === 2) return styles.grid2;
                if (totalUsers <= 4) return styles.grid4;
                if (totalUsers <= 9) return styles.grid9;
                return styles.grid16;
        }
    };

    return (
        <div className={clsx(styles.container, getGridClass())}>
            {/* 屏幕共享区域 - 主屏幕 */}
            {hasScreenShare && (
                <div className={clsx(styles.videoItem, styles.screenShareMain)}>
                    <div
                        ref={screenShareRef}
                        className={styles.screenShareVideo}
                        id={screenShareUserId ? `screen-share-${screenShareUserId}` : 'local-screen-share'}
                    >
                        {/* 视频流会自动渲染到这个元素 */}
                    </div>
                    {/* 远程用户共享时显示名称标签 */}
                    {!isScreenSharing && screenShareUserId && (
                        <div className={styles.nameTag}>
                            <span>{screenShareUserId} {t('meeting.screenShare')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* 参与者视频区域 - 侧边栏（屏幕共享时）或宫格（正常时） */}
            <div className={hasScreenShare ? styles.participantsSidebar : styles.participantsGrid}>
                {/* 本地视频 */}
                <div className={styles.videoItem}>
                    <div
                        ref={localVideoRef}
                        className={styles.video}
                        id="local-video"
                    >
                        {/* 占位符始终存在，视频流会通过 CSS z-index 覆盖 */}
                        <div className={styles.placeholder}>
                            <div className={styles.avatar}>
                                {(currentUserName || currentUserId).charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                    <div className={styles.participantInfo}>
                        <div className={clsx(styles.micIcon, !isMicOn && styles.micOff)}>
                            {isMicOn ? <MicOnIcon /> : <MicOffIcon />}
                        </div>
                        <span>{currentUserName || currentUserId}</span>
                    </div>
                </div>

                {/* 远程用户视频 */}
                {remoteUsers.map((userId) => {
                    const isAudioOn = memberAudioStates[userId] ?? true;
                    return (
                        <div key={userId} className={styles.videoItem}>
                            <div
                                className={styles.video}
                                id={`remote-video-${userId}`}
                            >
                                <div className={styles.placeholder}>
                                    <div className={styles.avatar}>
                                        {(remoteUserNames[userId] || userId).charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.participantInfo}>
                                <div className={clsx(styles.micIcon, !isAudioOn && styles.micOff)}>
                                    {isAudioOn ? <MicOnIcon /> : <MicOffIcon />}
                                </div>
                                <span>{remoteUserNames[userId] || userId}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// 使用 React.memo 包装以优化性能（只有 props 变化时才重新渲染）
export const VideoGrid = memo(VideoGridComponent, (prevProps, nextProps) => {
    // 浅比较，需要特别处理的是 remoteUsers 和 remoteUserNames
    return (
        prevProps.remoteUsers.length === nextProps.remoteUsers.length &&
        prevProps.remoteUsers.every((id, i) => id === nextProps.remoteUsers[i]) &&
        prevProps.isCameraOn === nextProps.isCameraOn &&
        prevProps.isMicOn === nextProps.isMicOn &&
        prevProps.isScreenSharing === nextProps.isScreenSharing &&
        prevProps.screenShareUserId === nextProps.screenShareUserId &&
        prevProps.layout === nextProps.layout &&
        prevProps.currentUserId === nextProps.currentUserId &&
        prevProps.currentUserName === nextProps.currentUserName &&
        JSON.stringify(prevProps.memberAudioStates) === JSON.stringify(nextProps.memberAudioStates)
    );
});

export default VideoGrid;

