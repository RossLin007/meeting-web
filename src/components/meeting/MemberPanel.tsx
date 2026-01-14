// 智会 - 成员面板组件

import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { RemoteUser } from '@/types';
import type { MemberMediaState } from '@/hooks/useRoomState';
import styles from './MemberPanel.module.css';

interface MemberInfo {
    userId: string;
    userName: string;
    isHost: boolean;
    isMuted: boolean;
    isCameraOff: boolean;
    isHandRaised?: boolean;
    isCoHost?: boolean;
}

interface MemberPanelProps {
    members: (RemoteUser & { userName?: string })[];
    memberStates?: Map<string, MemberMediaState>;  // IM 广播的成员状态
    socketMembers?: Array<{  // Socket.io 成员状态
        userId: string;
        userName: string;
        role: 'host' | 'cohost' | 'member';
        isAudioOn: boolean;
        isVideoOn: boolean;
        isScreenSharing: boolean;
        isHandRaised: boolean;
    }>;
    currentUserId: string;
    currentUserName?: string;
    hostId: string;  // 主持人 userId
    isHost: boolean;
    isMicOn: boolean;      // 当前用户麦克风状态
    isCameraOn: boolean;   // 当前用户摄像头状态
    onClose: () => void;
    onToggleMic?: () => void;      // 切换当前用户麦克风
    onToggleCamera?: () => void;   // 切换当前用户摄像头
    onMuteMember?: (userId: string) => void;
    onUnmuteMember?: (userId: string) => void;
    onStopMemberVideo?: (userId: string) => void;
    onSetHost?: (userId: string) => void;
    onRenameMember?: (userId: string, newName: string) => void;
    onKickMember?: (userId: string) => void;  // 踢出成员
    onMuteAll?: () => void;        // 全体静音
    onStopAllVideo?: () => void;   // 全体关闭视频
    // 等候室相关
    waitingList?: Array<{ userId: string; userName: string; joinedAt: number }>;
    waitingRoomEnabled?: boolean;
    onToggleWaitingRoom?: (enabled: boolean) => void;
    onAdmitFromWaitingRoom?: (userId: string) => void;
    onRejectFromWaitingRoom?: (userId: string) => void;
    onAdmitAllFromWaitingRoom?: () => void;
    hideHeader?: boolean;  // 隐藏头部（用于 FloatingPanel 包裹时）
}

// 图标组件
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const CrownIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
    </svg>
);

const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
);

const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    </svg>
);

const VideoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const VideoOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3" />
    </svg>
);

const KickIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" y1="8" x2="23" y2="8" />
    </svg>
);

const MoreIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
    </svg>
);

const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// 举手图标
const HandRaiseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="16" height="16">
        <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
);

function MemberPanelComponent({
    members,
    memberStates,
    socketMembers,
    currentUserId,
    currentUserName,
    hostId,
    isHost,
    isMicOn,
    isCameraOn,
    onClose,
    onToggleMic,
    onToggleCamera,
    onMuteMember,
    onUnmuteMember,
    onStopMemberVideo,
    onSetHost,
    onRenameMember,
    onKickMember,
    onMuteAll,
    onStopAllVideo,
    // 等候室
    waitingList = [],
    waitingRoomEnabled = false,
    onToggleWaitingRoom,
    onAdmitFromWaitingRoom,
    onRejectFromWaitingRoom,
    onAdmitAllFromWaitingRoom,
    hideHeader = false,
}: MemberPanelProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [editingMember, setEditingMember] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // 判断当前用户是否为主持人（使用 hostId 或传入的 isHost prop）
    const currentIsHost = hostId === currentUserId || isHost;

    // 构建成员列表（包含当前用户）- 优先使用 Socket 成员状态
    const allMembers = useMemo(() => {
        // 如果有 Socket 成员数据，优先使用
        if (socketMembers && socketMembers.length > 0) {
            return socketMembers.map((m) => ({
                userId: m.userId,
                userName: m.userName,
                isHost: m.role === 'host',
                isCoHost: m.role === 'cohost',
                isMuted: !m.isAudioOn,
                isCameraOff: !m.isVideoOn,
                isHandRaised: m.isHandRaised,
            }));
        }

        // 否则使用 TRTC + IM 状态
        return [
            {
                userId: currentUserId,
                userName: currentUserName || currentUserId,
                isHost: currentIsHost,
                isCoHost: false,
                isMuted: !isMicOn,
                isCameraOff: !isCameraOn,
                isHandRaised: false,
            },
            ...members.map((m) => {
                const imState = memberStates?.get(m.userId);
                return {
                    userId: m.userId,
                    userName: imState?.displayName || m.userName || m.userId,
                    isHost: hostId === m.userId,
                    isCoHost: false,
                    isMuted: imState ? !imState.isAudioOn : !m.hasAudio,
                    isCameraOff: imState ? !imState.isVideoOn : !m.hasVideo,
                    isHandRaised: false,
                };
            }),
        ];
    }, [socketMembers, currentUserId, currentUserName, currentIsHost, isMicOn, isCameraOn, members, hostId, memberStates]);

    // 过滤成员 - 使用 useMemo 优化性能
    const filteredMembers = useMemo(() =>
        allMembers.filter(
            (m) =>
                m.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.userId.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [allMembers, searchQuery]
    );

    // 处理改名
    const handleStartRename = (member: MemberInfo) => {
        setEditingMember(member.userId);
        setEditName(member.userName);
        setActiveMenu(null);
    };

    const handleSaveRename = (userId: string) => {
        if (editName.trim() && onRenameMember) {
            onRenameMember(userId, editName.trim());
        }
        setEditingMember(null);
        setEditName('');
    };

    const handleCancelRename = () => {
        setEditingMember(null);
        setEditName('');
    };

    return (
        <div className={styles.container}>
            {/* 头部 - 可隐藏 */}
            {!hideHeader && (
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('members.title')} ({allMembers.length})
                    </h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>
            )}

            {/* 搜索框 */}
            <div className={styles.searchBox}>
                <SearchIcon />
                <input
                    type="text"
                    placeholder={t('members.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* 等候室管理（仅主持人可见） */}
            {currentIsHost && onToggleWaitingRoom && (
                <div className={styles.waitingRoomSection}>
                    <div className={styles.waitingRoomHeader}>
                        <span>{t('waitingRoom.title', '等候室')}</span>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={waitingRoomEnabled}
                                onChange={(e) => onToggleWaitingRoom(e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>

                    {waitingRoomEnabled && waitingList.length > 0 && (
                        <>
                            <div className={styles.waitingListHeader}>
                                <span>{t('waitingRoom.waiting', '等待中')} ({waitingList.length})</span>
                                {onAdmitAllFromWaitingRoom && (
                                    <button
                                        className={styles.admitAllBtn}
                                        onClick={onAdmitAllFromWaitingRoom}
                                    >
                                        {t('waitingRoom.admitAll', '全部允许')}
                                    </button>
                                )}
                            </div>
                            <div className={styles.waitingList}>
                                {waitingList.map((waiter) => (
                                    <div key={waiter.userId} className={styles.waitingItem}>
                                        <div className={styles.avatar}>
                                            <UserIcon />
                                        </div>
                                        <span className={styles.waiterName}>{waiter.userName}</span>
                                        <div className={styles.waitingActions}>
                                            {onAdmitFromWaitingRoom && (
                                                <button
                                                    className={styles.admitBtn}
                                                    onClick={() => onAdmitFromWaitingRoom(waiter.userId)}
                                                    title={t('waitingRoom.admit', '允许进入')}
                                                >
                                                    ✓
                                                </button>
                                            )}
                                            {onRejectFromWaitingRoom && (
                                                <button
                                                    className={styles.rejectBtn}
                                                    onClick={() => onRejectFromWaitingRoom(waiter.userId)}
                                                    title={t('waitingRoom.reject', '拒绝')}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 成员列表 */}
            <div className={styles.memberList}>
                {filteredMembers.map((member) => (
                    <div key={member.userId} className={styles.memberItem}>
                        <div className={styles.avatar}>
                            <UserIcon />
                        </div>
                        <div className={styles.memberInfo}>
                            {editingMember === member.userId ? (
                                <div className={styles.renameInput}>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveRename(member.userId);
                                            if (e.key === 'Escape') handleCancelRename();
                                        }}
                                        autoFocus
                                    />
                                    <button onClick={() => handleSaveRename(member.userId)}>✓</button>
                                    <button onClick={handleCancelRename}>✕</button>
                                </div>
                            ) : (
                                <span className={styles.memberName}>
                                    {member.userName}
                                    {member.userId === currentUserId && ` (${t('members.you')})`}
                                    {/* 改名按钮：自己可以改自己，主持人可以改所有人 */}
                                    {(member.userId === currentUserId || currentIsHost) && onRenameMember && (
                                        <button
                                            className={styles.editNameBtn}
                                            onClick={() => handleStartRename(member)}
                                            title={t('members.rename')}
                                        >
                                            <EditIcon />
                                        </button>
                                    )}
                                </span>
                            )}
                            {member.isHost && (
                                <span className={styles.hostBadge}>
                                    <CrownIcon />
                                    {t('members.host')}
                                </span>
                            )}
                            {member.isCoHost && !member.isHost && (
                                <span className={styles.coHostBadge}>
                                    <CrownIcon />
                                    {t('members.cohost', '联席主持人')}
                                </span>
                            )}
                            {member.isHandRaised && (
                                <span className={styles.handRaisedBadge} title={t('meeting.handRaised')}>
                                    <HandRaiseIcon />
                                </span>
                            )}
                        </div>

                        {/* 状态指示器 - 当前用户可点击切换 */}
                        <div className={styles.statusIcons}>
                            {member.userId === currentUserId ? (
                                <>
                                    <button
                                        className={clsx(styles.statusButton, member.isMuted && styles.off)}
                                        onClick={onToggleMic}
                                        title={member.isMuted ? '取消静音' : '静音'}
                                    >
                                        {member.isMuted ? <MicOffIcon /> : <MicIcon />}
                                    </button>
                                    <button
                                        className={clsx(styles.statusButton, member.isCameraOff && styles.off)}
                                        onClick={onToggleCamera}
                                        title={member.isCameraOff ? '打开摄像头' : '关闭摄像头'}
                                    >
                                        {member.isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className={clsx(styles.statusIcon, member.isMuted && styles.off)}>
                                        {member.isMuted ? <MicOffIcon /> : <MicIcon />}
                                    </span>
                                    <span className={clsx(styles.statusIcon, member.isCameraOff && styles.off)}>
                                        {member.isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* 操作菜单（每个成员都显示，但菜单项根据权限控制） */}
                        <div className={styles.menuWrapper}>
                            <button
                                className={styles.menuBtn}
                                onClick={() => setActiveMenu(activeMenu === member.userId ? null : member.userId)}
                            >
                                <MoreIcon />
                            </button>

                            {activeMenu === member.userId && (
                                <div className={styles.dropdown}>
                                    {/* 改名：自己可改自己，主持人可改所有人 */}
                                    {(member.userId === currentUserId || currentIsHost) && onRenameMember && (
                                        <button onClick={() => handleStartRename(member)}>
                                            <EditIcon />
                                            {t('members.rename')}
                                        </button>
                                    )}
                                    {/* 设为主持人：仅主持人可用，不能设置自己 */}
                                    {currentIsHost && member.userId !== currentUserId && (
                                        <button onClick={() => { onSetHost?.(member.userId); setActiveMenu(null); }}>
                                            <CrownIcon />
                                            {t('members.setHost')}
                                        </button>
                                    )}
                                    {/* 静音/取消静音：仅主持人可用，不能控制自己 */}
                                    {currentIsHost && member.userId !== currentUserId && (
                                        <button onClick={() => {
                                            member.isMuted ? onUnmuteMember?.(member.userId) : onMuteMember?.(member.userId);
                                            setActiveMenu(null);
                                        }}>
                                            {member.isMuted ? <MicIcon /> : <MicOffIcon />}
                                            {member.isMuted ? t('members.unmute') : t('members.mute')}
                                        </button>
                                    )}
                                    {/* 关闭视频：仅主持人可用，不能控制自己 */}
                                    {currentIsHost && member.userId !== currentUserId && (
                                        <button onClick={() => { onStopMemberVideo?.(member.userId); setActiveMenu(null); }}>
                                            <VideoOffIcon />
                                            {t('members.stopVideo')}
                                        </button>
                                    )}
                                    {/* 移除成员：仅主持人可用，不能移除自己 */}
                                    {currentIsHost && member.userId !== currentUserId && onKickMember && (
                                        <button
                                            onClick={() => { onKickMember(member.userId); setActiveMenu(null); }}
                                            className={styles.dangerBtn}
                                        >
                                            <KickIcon />
                                            {t('members.kick', '移除成员')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 底部控制按钮（仅主持人可见） */}
            {currentIsHost && (
                <div className={styles.footer}>
                    {onMuteAll && (
                        <button
                            className={styles.footerIconBtn}
                            onClick={onMuteAll}
                            title={t('members.muteAll')}
                        >
                            <MicOffIcon />
                        </button>
                    )}
                    {onStopAllVideo && (
                        <button
                            className={styles.footerIconBtn}
                            onClick={onStopAllVideo}
                            title={t('members.stopAllVideo')}
                        >
                            <VideoOffIcon />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// 使用 React.memo 优化性能
export const MemberPanel = memo(MemberPanelComponent);

export default MemberPanel;
