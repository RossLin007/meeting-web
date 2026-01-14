// 智会 - 会议室页面

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTRTC, useIM, useRecording, useRoomState, useMeetingHandlers, useSocket } from '@/hooks';
import { useMeetingStore } from '@/services/store';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { validateRoomId, validateUserId } from '@/utils/urlValidation';
import { VideoGrid } from '@/components/meeting/VideoGrid';
import { Toolbar } from '@/components/meeting/Toolbar';
import { ChatPanel } from '@/components/meeting/ChatPanel';
import { MemberPanel } from '@/components/meeting/MemberPanel';
import { FloatingPanel } from '@/components/meeting/FloatingPanel';
import { TopBar } from '@/components/meeting/TopBar';
import { InviteModal } from '@/components/meeting/InviteModal';
import { SettingsModal } from '@/components/meeting/SettingsModal';
import { EndMeetingModal } from '@/components/meeting/EndMeetingModal';
import { RecordingControl } from '@/components/meeting/RecordingControl';
import { LayoutSelector, type LayoutType } from '@/components/meeting/LayoutSelector';
import { WaitingRoom } from '@/components/meeting/WaitingRoom';
import styles from './Meeting.module.css';

const DEFAULT_TIMEOUT = 30000;

// SDK_APP_ID 从环境变量获取（移除硬编码后备值）
const SDK_APP_ID = Number(import.meta.env.VITE_TRTC_SDK_APP_ID);
if (!SDK_APP_ID || isNaN(SDK_APP_ID)) {
    console.error('❌ 缺少 VITE_TRTC_SDK_APP_ID 配置');
}

export function Meeting() {
    const { roomId } = useParams<{ roomId: string }>();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();

    const localVideoRef = useRef<HTMLDivElement>(null);
    const screenShareRef = useRef<HTMLDivElement>(null);

    const { currentUser, isMicOn, isCameraOn, isScreenSharing, setMicOn, setCameraOn, setScreenSharing, reset, setCurrentUser } = useMeetingStore();
    const { user: authUser, userId: authUserId, userSig: authUserSig, isLoggedIn } = useAuth();
    const { addToast } = useToast();

    // 同步 SSO 用户到 useMeetingStore
    useEffect(() => {
        if (isLoggedIn && authUser && authUserId && authUserSig) {
            console.log('🔄 同步 SSO 用户到会议:', authUser.username);
            setCurrentUser({
                userId: authUserId,
                userName: authUser.username,
                userSig: authUserSig,
            });
        }
    }, [isLoggedIn, authUser, authUserId, authUserSig, setCurrentUser]);

    const [showChat, setShowChat] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [isFullscreen] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showEndMeeting, setShowEndMeeting] = useState(false);
    const [, setUnreadCountCallback] = useState(0);
    const [remoteUserNames, setRemoteUserNames] = useState<Record<string, string>>({});
    const [layout, setLayout] = useState<LayoutType>('gallery');
    const [showLayoutSelector, setShowLayoutSelector] = useState(false);
    const [latestChat, setLatestChat] = useState<{
        senderName: string;
        content: string;
        timestamp: number;
    } | undefined>(undefined);
    const [hasShownRecordingNotice, setHasShownRecordingNotice] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);

    // 后端 API 基础 URL
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // 验证 roomId
    const roomIdValidation = validateRoomId(roomId);
    if (!roomIdValidation.valid && roomId) {
        console.error('❌ roomId 验证失败:', roomIdValidation.error);
    }

    // 从 URL 参数恢复用户身份（带验证）
    useEffect(() => {
        const urlUserId = searchParams.get('userId');
        const userIdValidation = validateUserId(urlUserId);

        // 如果 URL 有 userId，且当前是 guest 用户，则恢复
        if (userIdValidation.valid && userIdValidation.sanitized && currentUser.userId.startsWith('guest_')) {
            const sanitizedUserId = userIdValidation.sanitized;
            console.log('🔑 从 URL 恢复用户身份:', sanitizedUserId);

            fetchWithTimeout(`${API_BASE_URL}/api/usersig/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: sanitizedUserId }),
            }, DEFAULT_TIMEOUT)
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setCurrentUser({
                            userId: sanitizedUserId,
                            userName: sanitizedUserId,
                            userSig: data.data.userSig,
                        });
                    }
                })
                .catch((err) => console.error('恢复用户身份失败:', err));
        }
    }, [searchParams, setCurrentUser, API_BASE_URL, currentUser.userId]);

    // TRTC Hook
    const {
        isJoined,
        remoteUsers,
        networkQuality,
        screenShareUserId,
        joinRoom,
        leaveRoom,
        startLocalVideo,
        stopLocalVideo,
        toggleAudio,
        startScreenShare,
        stopScreenShare,
        updateScreenShare,
        startRemoteVideo,
    } = useTRTC({
        onError: (error) => {
            console.error('TRTC error:', error);
        },
    });

    // 用于回调的离开会议函数 ref（避免循环依赖）
    const leaveMeetingRef = useRef<() => void>(() => { });

    // 简单的离开会议逻辑（用于回调）
    const doLeaveMeeting = useCallback(() => {
        leaveMeetingRef.current();
    }, []);

    // IM Hook
    const {
        isJoinedGroup,
        unreadCount,  // 从 useIM 获取的未读数量
        messages,
        login: loginIM,
        joinGroup,
        leaveGroup,
        sendMessage,
        sendImage,
        sendFile,
        loadHistory,
    } = useIM({
        onError: (error) => {
            console.error('IM error:', error);
        },
        isChatVisible: showChat,  // 传递聊天面板可见性
        onUnreadCountChange: setUnreadCountCallback,  // 更新未读数量
        onNewMessage: (newMessages) => {
            // 获取最新一条消息用于顶部栏显示
            if (newMessages.length > 0) {
                const latest = newMessages[newMessages.length - 1];
                // 只显示文本消息，且不是自己发的
                if (latest.type === 'text' && latest.senderId !== currentUser.userId) {
                    setLatestChat({
                        senderName: latest.senderName || latest.senderId,
                        content: latest.content,
                        timestamp: Date.now(),
                    });
                }
            }
        },
    });

    // 房间状态 Hook（主持人/录制状态同步）- IM 方式
    const {
        roomState,
        isHost,
        canControl,
        memberStates,
        broadcastRecordingStart,
        broadcastRecordingStop,
        broadcastMeetingEnd,
        broadcastAudioState: imBroadcastAudioState,
        broadcastVideoState: imBroadcastVideoState,
        broadcastScreenShareState: imBroadcastScreenShareState,
    } = useRoomState({
        meetingId: roomId || '',
        userId: currentUser.userId,
        onRecordingChange: (isRecording) => {
            console.log('🔔 录制状态变更:', isRecording);
        },
        onMeetingEnd: () => {
            // 收到会议结束通知，自动离开
            console.log('🔔 会议已被主持人结束，自动离开');
            doLeaveMeeting();
        },
    });

    // Socket.io 状态同步 Hook（新）
    const {
        isConnected: _socketConnected,
        members: socketMembers,
        hostId: socketHostId,
        isHost: socketIsHost,
        canControl: socketCanControl,
        isRecording: _socketIsRecording,
        inWaitingRoom,
        waitingList,
        waitingRoomEnabled,
        broadcastAudioState: socketBroadcastAudioState,
        broadcastVideoState: socketBroadcastVideoState,
        broadcastScreenShareState: socketBroadcastScreenShareState,
        broadcastHandRaised: socketBroadcastHandRaised,
        endMeeting: socketEndMeeting,
        muteAll: socketMuteAll,
        stopVideoAll: socketStopVideoAll,
        muteMember: socketMuteMember,
        stopVideoMember: socketStopVideoMember,
        kickMember: socketKickMember,
        transferHost: socketTransferHost,
        toggleWaitingRoom,
        admitFromWaitingRoom,
        rejectFromWaitingRoom,
        admitAllFromWaitingRoom,
    } = useSocket({
        userId: currentUser.userId,
        userName: currentUser.userName,
        meetingId: roomId || '',
        autoConnect: !!currentUser.userSig && !currentUser.userId.startsWith('guest_'),
        onKicked: (forever) => {
            console.log('🚫 你被踢出会议', forever ? '(永久)' : '');
            doLeaveMeeting();
        },
        onMeetingEnded: () => {
            console.log('🛑 会议已结束');
            doLeaveMeeting();
        },
        onMutedByHost: async (by) => {
            console.log('🔇 被主持人静音:', by);
            try {
                await toggleAudio();
                setMicOn(false);
                imBroadcastAudioState(false);
                socketBroadcastAudioState(false);
                addToast('主持人已将你静音', 'warning', 4000);
            } catch (error) {
                console.error('关闭麦克风失败:', error);
            }
        },
        onVideoStoppedByHost: async (by) => {
            console.log('📹 视频被主持人关闭:', by);
            try {
                await stopLocalVideo();
                setCameraOn(false);
                imBroadcastVideoState(false);
                socketBroadcastVideoState(false);
                addToast('主持人已关闭你的视频', 'warning', 4000);
            } catch (error) {
                console.error('关闭摄像头失败:', error);
            }
        },
        onStoppedAllVideo: async () => {
            console.log('📹 全体关闭视频');
            try {
                await stopLocalVideo();
                setCameraOn(false);
                imBroadcastVideoState(false);
                socketBroadcastVideoState(false);
                addToast(t('members.hostStoppedAllVideo', '主持人已关闭所有人的视频'), 'warning', 4000);
            } catch (error) {
                console.error('关闭摄像头失败:', error);
            }
        },
    });

    // 统一的广播函数（同时通过 IM 和 Socket 广播）
    const broadcastAudioState = (isOn: boolean) => {
        imBroadcastAudioState(isOn);
        socketBroadcastAudioState(isOn);
    };
    const broadcastVideoState = (isOn: boolean) => {
        imBroadcastVideoState(isOn);
        socketBroadcastVideoState(isOn);
    };
    const broadcastScreenShareState = (isSharing: boolean) => {
        imBroadcastScreenShareState(isSharing);
        socketBroadcastScreenShareState(isSharing);
    };

    // 加入房间（等待 userSig 准备好）
    useEffect(() => {
        // 确保有 roomId、userSig，且尚未加入
        if (!roomId || isJoined) return;
        if (!currentUser.userSig || currentUser.userId.startsWith('guest_')) {
            console.log('⏳ 等待用户身份恢复...', currentUser.userId);
            return;
        }

        const join = async () => {
            try {
                console.log('🚀 加入 TRTC 房间:', roomId, '用户:', currentUser.userId);
                // 加入 TRTC 房间
                await joinRoom({
                    sdkAppId: SDK_APP_ID,
                    userId: currentUser.userId,
                    userSig: currentUser.userSig,
                    roomId: parseInt(roomId, 10),
                });

                // 主持人状态由 useRoomState 管理
                console.log('✅ 会议加入完成');

                // 登录 IM 并加入群组（允许失败，不阻止会议功能）
                try {
                    await loginIM(currentUser.userId, currentUser.userSig);
                    await joinGroup(roomId);
                    await loadHistory();
                    console.log('IM 群组加入成功');
                } catch (imError) {
                    console.error('IM 加入失败（聊天功能可能不可用）:', imError);
                }

                // 开启本地视频
                if (localVideoRef.current && isCameraOn) {
                    await startLocalVideo(localVideoRef.current);
                }

                // 开启本地音频
                if (isMicOn) {
                    await toggleAudio();
                }
            } catch (error) {
                console.error('Failed to join room:', error);
            }
        };

        join();

        return () => {
            // 清理
            leaveRoom();
            leaveGroup();
            reset();
        };
    }, [roomId]);

    // 跟踪已启动的远程视频流（修复内存泄漏）
    const activeRemoteStreams = useRef<Set<string>>(new Set());

    // 处理远程用户视频 - 带清理逻辑防止内存泄漏
    useEffect(() => {
        const currentUsers = new Set(remoteUsers);

        // 启动新用户的视频
        remoteUsers.forEach((userId) => {
            if (!activeRemoteStreams.current.has(userId)) {
                const element = document.getElementById(`remote-video-${userId}`);
                if (element) {
                    startRemoteVideo(userId, element);
                    activeRemoteStreams.current.add(userId);
                }
            }
        });

        // 停止已离开用户的视频流（清理内存）
        activeRemoteStreams.current.forEach((userId) => {
            if (!currentUsers.has(userId)) {
                console.log('🧹 清理离开用户的视频流:', userId);
                activeRemoteStreams.current.delete(userId);
                // 注意：实际停止视频流由 useTRTC hook 的 onRemoteUserLeave 事件处理
            }
        });
    }, [remoteUsers, startRemoteVideo]);

    // 从后端 API 获取远程用户名（优先方案）
    // 使用 useRef 追踪已查询的用户，避免重复请求
    const fetchedUserIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const fetchUserNames = async () => {
            // 筛选还没有查询过的远程用户
            const unknownUsers = remoteUsers.filter(id => !fetchedUserIdsRef.current.has(id));
            if (unknownUsers.length === 0) return;

            // 标记为已查询，避免重复请求
            unknownUsers.forEach(id => fetchedUserIdsRef.current.add(id));

            try {
                const response = await fetchWithTimeout(`${API_BASE_URL}/api/users?ids=${unknownUsers.join(',')}`, {}, DEFAULT_TIMEOUT);
                const result = await response.json();

                if (result.success && result.data) {
                    setRemoteUserNames(prev => {
                        const updated = { ...prev };
                        Object.entries(result.data as Record<string, { name: string }>).forEach(([id, user]) => {
                            updated[id] = user.name;
                        });
                        return updated;
                    });
                    console.log('✅ 从后端获取远程用户名:', result.data);
                }
            } catch (error) {
                console.warn('⚠️ 获取远程用户名失败，将使用 IM 消息提取:', error);
            }
        };

        fetchUserNames();
    }, [remoteUsers]); // 只依赖 remoteUsers，不依赖 remoteUserNames

    // 从 IM 消息提取远程用户名（备用方案）
    useEffect(() => {
        messages.forEach((msg) => {
            if (msg.senderId && msg.senderName && msg.senderId !== msg.senderName) {
                setRemoteUserNames((prev) => {
                    if (prev[msg.senderId] !== msg.senderName) {
                        return { ...prev, [msg.senderId]: msg.senderName };
                    }
                    return prev;
                });
            }
        });
    }, [messages]);

    // 从 Socket 成员同步用户名（优先级最高）
    useEffect(() => {
        if (socketMembers && socketMembers.length > 0) {
            setRemoteUserNames((prev) => {
                const updated = { ...prev };
                let hasChanges = false;
                socketMembers.forEach((member) => {
                    // 只同步有真实用户名的成员（userName !== userId）
                    if (member.userName && member.userName !== member.userId && updated[member.userId] !== member.userName) {
                        updated[member.userId] = member.userName;
                        hasChanges = true;
                    }
                });
                return hasChanges ? updated : prev;
            });
        }
    }, [socketMembers]);

    // 屏幕共享开始后更新预览视图
    useEffect(() => {
        if (isScreenSharing && screenShareRef.current) {
            // 使用 setTimeout 确保 DOM 已经渲染
            const timer = setTimeout(() => {
                if (screenShareRef.current) {
                    updateScreenShare(screenShareRef.current);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isScreenSharing, updateScreenShare]);

    // 使用 useMeetingHandlers hook 替代内联处理函数
    const {
        handleToggleCamera,
        handleToggleMic,
        handleToggleScreenShare,
        handleToggleFullscreen,
        handleLeaveMeeting,
        handleEndMeeting,
        handleSendMessage,
        handleSendImage,
        handleSendFile,
    } = useMeetingHandlers({
        roomId,
        userId: currentUser.userId,
        localVideoRef,
        screenShareRef,
        startLocalVideo,
        stopLocalVideo,
        toggleAudio,
        startScreenShare,
        stopScreenShare,
        leaveRoom,
        sendMessage,
        sendImage,
        sendFile,
        leaveGroup,
        setCameraOn,
        setMicOn,
        setScreenSharing,
        reset,
        isCameraOn,
        isMicOn,
        isScreenSharing,
        broadcastMeetingEnd,
        broadcastAudioState: async (isOn: boolean) => { socketBroadcastAudioState(isOn); },
        broadcastVideoState: async (isOn: boolean) => { socketBroadcastVideoState(isOn); },
        broadcastScreenShareState: async (isSharing: boolean) => { socketBroadcastScreenShareState(isSharing); },
    });

    // 同步 handleLeaveMeeting 到 ref（避免循环依赖）
    useEffect(() => {
        leaveMeetingRef.current = handleLeaveMeeting;
    }, [handleLeaveMeeting]);

    const meetingTitle = searchParams.get('title') || t('meeting.title');

    // 录制 Hook
    const { isRecording, recordingTime, startRecording, stopRecording } = useRecording({
        roomId: roomId || '',
        memberCount: remoteUsers.length + 1,  // +1 包含自己
        onError: (error) => console.error('Recording error:', error),
    });

    // 加入会议时检测录制状态，显示提示
    useEffect(() => {
        if (!hasShownRecordingNotice && roomState?.recording?.isRecording) {
            addToast(
                t('recording.meetingIsRecording', '会议正在录制中，您的音视频将被记录'),
                'warning',
                5000
            );
            setHasShownRecordingNotice(true);
        }
    }, [roomState?.recording?.isRecording, hasShownRecordingNotice, addToast, t]);

    // 加载状态：等待用户身份验证
    const isLoading = !currentUser.userSig || currentUser.userId.startsWith('guest_');

    // 如果正在加载，显示加载结界面
    if (isLoading) {
        return (
            <div className={styles.container} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <div style={{ color: 'white', fontSize: '16px' }}>
                    {t('meeting.connecting')}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                    {t('meeting.waitingForAuth')}
                </div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // 如果用户在等候室中
    if (inWaitingRoom) {
        return (
            <WaitingRoom
                userName={currentUser.userName || currentUser.userId}
                onLeave={doLeaveMeeting}
            />
        );
    }

    return (
        <div className={styles.container}>
            {/* 顶部栏 */}
            <div className={styles.topSection}>
                <TopBar
                    title={meetingTitle}
                    networkQuality={networkQuality}
                    latestChat={latestChat}
                />
                {/* 录制控制 */}
                <div className={styles.recordingWrapper}>
                    <RecordingControl
                        isRecording={isRecording}
                        isRoomRecording={roomState?.recording?.isRecording ?? false}
                        recordingTime={recordingTime}
                        isHost={isHost || canControl}
                        onStartRecording={async () => {
                            const taskId = await startRecording();
                            if (taskId) {
                                await broadcastRecordingStart(taskId);
                            }
                        }}
                        onStopRecording={async () => {
                            await stopRecording();
                            await broadcastRecordingStop();
                        }}
                    />
                </div>
            </div>

            {/* 主内容区 */}
            <div className={styles.main}>
                {/* 视频区域 */}
                <div className={styles.videoArea}>
                    <VideoGrid
                        localVideoRef={localVideoRef}
                        screenShareRef={screenShareRef}
                        remoteUsers={socketMembers.length > 0
                            ? remoteUsers.filter(userId => socketMembers.some(m => m.userId === userId))
                            : remoteUsers}
                        remoteUserNames={remoteUserNames}
                        memberAudioStates={socketMembers.reduce((acc, m) => {
                            acc[m.userId] = m.isAudioOn;
                            return acc;
                        }, {} as Record<string, boolean>)}
                        currentUserId={currentUser.userId}
                        currentUserName={currentUser.userName}
                        isCameraOn={isCameraOn}
                        isMicOn={isMicOn}
                        isScreenSharing={isScreenSharing}
                        screenShareUserId={screenShareUserId}
                        layout={layout}
                    />
                </div>

                {/* 聊天面板 - 悬浮窗 */}
                <FloatingPanel
                    title={t('chat.title', '聊天')}
                    icon={
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    }
                    badge={unreadCount}
                    isOpen={showChat}
                    onClose={() => setShowChat(false)}
                    defaultPosition={{ x: window.innerWidth - 380, y: 70 }}
                    defaultSize={{ width: 360, height: 480 }}
                >
                    <ChatPanel
                        messages={messages}
                        currentUserId={currentUser.userId}
                        userNames={remoteUserNames}
                        isConnected={isJoinedGroup}
                        onSendMessage={handleSendMessage}
                        onSendImage={handleSendImage}
                        onSendFile={handleSendFile}
                        onClose={() => setShowChat(false)}
                        hideHeader
                    />
                </FloatingPanel>

                {/* 成员面板 - 悬浮窗 */}
                <FloatingPanel
                    title={t('members.title', '成员')}
                    icon={
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    }
                    badge={socketMembers.length}
                    isOpen={showMembers}
                    onClose={() => setShowMembers(false)}
                    defaultPosition={{ x: window.innerWidth - 380, y: 70 }}
                    defaultSize={{ width: 340, height: 520 }}
                >
                    <MemberPanel
                        members={remoteUsers.map(userId => ({ userId, userName: remoteUserNames[userId], hasAudio: false, hasVideo: false, hasScreenShare: false }))}
                        memberStates={memberStates}
                        socketMembers={socketMembers}
                        currentUserId={currentUser.userId}
                        currentUserName={currentUser.userName}
                        hostId={socketHostId || roomState.hostId || currentUser.userId}
                        isHost={socketIsHost || isHost}
                        isMicOn={isMicOn}
                        isCameraOn={isCameraOn}
                        onClose={() => setShowMembers(false)}
                        onToggleMic={handleToggleMic}
                        onToggleCamera={handleToggleCamera}
                        onRenameMember={(userId, newName) => {
                            // 临时改名：只更新本地状态，不保存到数据库
                            setRemoteUserNames(prev => ({ ...prev, [userId]: newName }));
                            console.log('✅ 临时用户名已更新:', userId, newName);
                        }}
                        onMuteMember={socketMuteMember}
                        onStopMemberVideo={socketStopVideoMember}
                        onSetHost={socketTransferHost}
                        onKickMember={(userId) => socketKickMember(userId, false)}
                        onMuteAll={() => {
                            socketMuteAll(true);
                            console.log('🔇 全体静音');
                        }}
                        onStopAllVideo={() => {
                            socketStopVideoAll();
                            console.log('📹 全体关闭视频');
                        }}
                        // 等候室
                        waitingList={waitingList}
                        waitingRoomEnabled={waitingRoomEnabled}
                        onToggleWaitingRoom={toggleWaitingRoom}
                        onAdmitFromWaitingRoom={admitFromWaitingRoom}
                        onRejectFromWaitingRoom={rejectFromWaitingRoom}
                        onAdmitAllFromWaitingRoom={admitAllFromWaitingRoom}
                        hideHeader
                    />
                </FloatingPanel>
            </div>

            {/* 底部工具栏 */}
            <Toolbar
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
                isScreenSharing={isScreenSharing}
                isFullscreen={isFullscreen}
                showChat={showChat}
                showMembers={showMembers}
                memberCount={remoteUsers.length + 1}
                unreadCount={unreadCount}
                isHandRaised={isHandRaised}
                onToggleHandRaise={() => {
                    const newState = !isHandRaised;
                    setIsHandRaised(newState);
                    socketBroadcastHandRaised(newState);
                    console.log(newState ? '✋ 举手' : '👇 放下手');
                }}
                isRecording={isRecording}
                isRoomRecording={roomState?.recording?.isRecording ?? false}
                recordingTime={recordingTime}
                canRecord={socketCanControl}  // 只有主持人/联席主持人可录制
                onToggleMic={handleToggleMic}
                onToggleCamera={handleToggleCamera}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleFullscreen={handleToggleFullscreen}
                onToggleChat={() => {
                    setShowChat(!showChat);
                    // unreadCount 会自动在聊天打开时清零（由 useIM hook 管理）
                }}
                onToggleMembers={() => setShowMembers(!showMembers)}
                onStartRecording={async () => {
                    const taskId = await startRecording();
                    if (taskId) {
                        await broadcastRecordingStart(taskId);
                    }
                }}
                onStopRecording={async () => {
                    await stopRecording();
                    await broadcastRecordingStop();
                }}
                onInvite={() => setShowInvite(true)}
                onSettings={() => setShowSettings(true)}
                onLayoutClick={() => setShowLayoutSelector(true)}
                onLeaveMeeting={() => setShowEndMeeting(true)}
            />

            {/* 邀请弹窗 */}
            <InviteModal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                roomId={roomId || ''}
                meetingTitle={searchParams.get('title') || t('home.title')}
                password={searchParams.get('password') || undefined}
            />

            {/* 设置弹窗 */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* 结束会议弹窗 */}
            <EndMeetingModal
                isOpen={showEndMeeting}
                onClose={() => setShowEndMeeting(false)}
                onEndMeeting={() => {
                    // 同时通过 Socket.io 广播结束会议
                    socketEndMeeting();
                    handleEndMeeting();
                }}
                onLeaveMeeting={handleLeaveMeeting}
                isHost={socketIsHost || isHost}
            />

            {/* 布局选择器 */}
            {showLayoutSelector && (
                <LayoutSelector
                    currentLayout={layout}
                    onLayoutChange={setLayout}
                    onClose={() => setShowLayoutSelector(false)}
                />
            )}
        </div>
    );
}

export default Meeting;
