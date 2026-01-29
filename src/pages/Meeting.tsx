// 智会 - 会议室页面

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTRTC, useIM, useRecording, useMeetingHandlers, useSocket, useRemoteVideo } from '@/hooks';
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

    const meetingTitleParam = searchParams.get('title');
    const localVideoRef = useRef<HTMLDivElement>(null);
    const screenShareRef = useRef<HTMLDivElement>(null);
    const remoteScreenShareUserRef = useRef<string | null>(null);
    const remoteScreenShareRetryRef = useRef(0);
    const remoteScreenShareTimerRef = useRef<number | null>(null);

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
    const lastRoomSyncRef = useRef(0);
    const [meetingTitle, setMeetingTitle] = useState(meetingTitleParam || t('meeting.title'));

    // 后端 API 基础 URL
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        setMeetingTitle(meetingTitleParam || t('meeting.title'));
    }, [meetingTitleParam, t]);

    useEffect(() => {
        if (meetingTitleParam || !roomId) return;
        let isActive = true;

        fetchWithTimeout(`${API_BASE_URL}/api/meetings/${roomId}`, {}, DEFAULT_TIMEOUT)
            .then((res) => res.json())
            .then((data) => {
                if (!isActive) return;
                if (data?.success && data.data?.title) {
                    setMeetingTitle(data.data.title);
                }
            })
            .catch((error) => {
                console.error('获取会议标题失败:', error);
            });

        return () => {
            isActive = false;
        };
    }, [meetingTitleParam, roomId, API_BASE_URL]);

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
        remoteVideoAvailableUsers,
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
        stopRemoteVideo,
    } = useTRTC({
        onError: (error) => {
            console.error('TRTC error:', error);
        },
        onRemoteVideoStateChange: (userId, isVideoOn) => {
            // TRTC 检测到远端视频状态变化，触发 Socket 重同步
            console.log(`📹 TRTC 远端视频状态变化: ${userId} -> ${isVideoOn ? '开启' : '关闭'}`);
            requestRoomState();
        },
    });

    // 用于回调的离开会议函数 ref（避免循环依赖）
    const leaveMeetingRef = useRef<() => void>(() => { });
    const endMeetingCleanupRef = useRef<() => void>(() => { });
    const endMeetingRequestedRef = useRef(false);

    // 简单的离开会议逻辑（用于回调）
    const doLeaveMeeting = useCallback(() => {
        leaveMeetingRef.current();
    }, []);

    const doEndMeetingCleanup = useCallback(() => {
        endMeetingCleanupRef.current();
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
        logout: logoutIM,
        clearLocalCache: clearImCache,
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

    // Socket.io 状态同步 Hook（新）
    const {
        isConnected: _socketConnected,
        members: socketMembers,
        hostId: socketHostId,
        isHost: socketIsHost,
        canControl: socketCanControl,
        isRecording: socketIsRecording,
        inWaitingRoom,
        waitingList,
        waitingRoomEnabled,
        broadcastAudioState: socketBroadcastAudioState,
        broadcastVideoState: socketBroadcastVideoState,
        broadcastScreenShareState: socketBroadcastScreenShareState,
        broadcastHandRaised: socketBroadcastHandRaised,
        reportMemberState,
        endMeeting: socketEndMeeting,
        leaveRoom: socketLeaveRoom,
        muteAll: socketMuteAll,
        stopVideoAll: socketStopVideoAll,
        muteMember: socketMuteMember,
        stopVideoMember: socketStopVideoMember,
        kickMember: socketKickMember,
        transferHost: socketTransferHost,
        startRecording: socketStartRecording,
        stopRecording: socketStopRecording,
        toggleWaitingRoom,
        admitFromWaitingRoom,
        rejectFromWaitingRoom,
        admitAllFromWaitingRoom,
        requestRoomState,
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
            if (endMeetingRequestedRef.current) return;
            doEndMeetingCleanup();
        },
        onMutedByHost: async (by) => {
            console.log('🔇 被主持人静音:', by);
            try {
                if (isMicOn) {
                    await toggleAudio();
                }
                setMicOn(false);
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
                socketBroadcastVideoState(false);
                addToast(t('members.hostStoppedAllVideo', '主持人已关闭所有人的视频'), 'warning', 4000);
            } catch (error) {
                console.error('关闭摄像头失败:', error);
            }
        },
    });

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
                // 先获取已有成员列表（修复竞态条件：TRTC 事件先于 Socket 事件）
                try {
                    const stateResponse = await fetchWithTimeout(
                        `${API_BASE_URL}/api/meetings/${roomId}/state`,
                        {},
                        DEFAULT_TIMEOUT
                    );
                    const stateResult = await stateResponse.json();
                    if (stateResult.success && stateResult.data?.members) {
                        const initialNames: Record<string, string> = {};
                        stateResult.data.members.forEach((m: { userId: string; userName: string }) => {
                            if (m.userName && m.userName !== m.userId) {
                                initialNames[m.userId] = m.userName;
                            }
                        });
                        if (Object.keys(initialNames).length > 0) {
                            console.log('📋 预加载成员名称:', initialNames);
                            setRemoteUserNames(prev => ({ ...initialNames, ...prev }));
                        }
                    }
                } catch (preloadError) {
                    console.warn('预加载成员名称失败（不影响加入）:', preloadError);
                }

                console.log('🚀 加入 TRTC 房间:', roomId, '用户:', currentUser.userId);
                // 加入 TRTC 房间
                await joinRoom({
                    sdkAppId: SDK_APP_ID,
                    userId: currentUser.userId,
                    userSig: currentUser.userSig,
                    roomId: parseInt(roomId, 10),
                });

                console.log('✅ 会议加入完成');

                // 并行启动本地音视频与 IM 登录
                const mediaTasks: Promise<unknown>[] = [];
                if (localVideoRef.current && isCameraOn) {
                    mediaTasks.push(startLocalVideo(localVideoRef.current));
                }
                if (isMicOn) {
                    mediaTasks.push(toggleAudio());
                }

                const imTask = (async () => {
                    try {
                        await loginIM(currentUser.userId, currentUser.userSig);
                        await joinGroup(roomId);
                        await loadHistory();
                        console.log('IM 群组加入成功');
                    } catch (imError) {
                        console.error('IM 加入失败（聊天功能可能不可用）:', imError);
                    }
                })();

                await Promise.allSettled([...mediaTasks, imTask]);
            } catch (error) {
                console.error('Failed to join room:', error);
            }
        };

        join();

        return () => {
            // 清理
            leaveRoom();
            leaveGroup();
            socketLeaveRoom();
            reset();
        };
    }, [roomId]);

    // Socket 成员同步用户名（唯一来源）

    // 从 Socket 成员同步用户名（优先级最高）
    useEffect(() => {
        if (socketMembers && socketMembers.length > 0) {
            setRemoteUserNames((prev) => {
                const updated = { ...prev };
                let hasChanges = false;
                socketMembers.forEach((member) => {
                    if (member.userName && updated[member.userId] !== member.userName) {
                        updated[member.userId] = member.userName;
                        hasChanges = true;
                    }
                });
                return hasChanges ? updated : prev;
            });
        }
    }, [socketMembers]);

    // 远程屏幕共享订阅
    useEffect(() => {
        const previousUserId = remoteScreenShareUserRef.current;
        if (previousUserId && previousUserId !== screenShareUserId) {
            stopRemoteVideo(previousUserId, true)
                .catch((err) => console.error('远程屏幕共享停止失败:', previousUserId, err))
                .finally(() => {
                    if (remoteScreenShareUserRef.current === previousUserId) {
                        remoteScreenShareUserRef.current = null;
                    }
                });
        }

        if (!screenShareUserId) {
            if (remoteScreenShareTimerRef.current !== null) {
                window.clearTimeout(remoteScreenShareTimerRef.current);
                remoteScreenShareTimerRef.current = null;
            }
            remoteScreenShareRetryRef.current = 0;
            return;
        }

        const scheduleRetry = () => {
            if (remoteScreenShareRetryRef.current >= 6) return;
            if (remoteScreenShareTimerRef.current !== null) return;
            remoteScreenShareRetryRef.current += 1;
            remoteScreenShareTimerRef.current = window.setTimeout(() => {
                remoteScreenShareTimerRef.current = null;
                startRemoteScreenShare();
            }, 500 * remoteScreenShareRetryRef.current);
        };

        const startRemoteScreenShare = () => {
            if (!screenShareRef.current) return false;
            startRemoteVideo(screenShareUserId, screenShareRef.current, true)
                .then((started) => {
                    if (started) {
                        remoteScreenShareUserRef.current = screenShareUserId;
                        remoteScreenShareRetryRef.current = 0;
                        return;
                    }
                    scheduleRetry();
                })
                .catch((err) => {
                    console.error('远程屏幕共享订阅失败:', screenShareUserId, err);
                    scheduleRetry();
                });
            return true;
        };

        if (startRemoteScreenShare()) return;

        const timer = setTimeout(() => {
            startRemoteScreenShare();
        }, 100);

        return () => {
            clearTimeout(timer);
            if (remoteScreenShareTimerRef.current !== null) {
                window.clearTimeout(remoteScreenShareTimerRef.current);
                remoteScreenShareTimerRef.current = null;
            }
        };
    }, [screenShareUserId, startRemoteVideo, stopRemoteVideo]);

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
        handleEndMeetingCleanup,
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
        logoutIM,
        clearImCache,
        leaveSocketRoom: socketLeaveRoom,
        setCameraOn,
        setMicOn,
        setScreenSharing,
        reset,
        isCameraOn,
        isMicOn,
        isScreenSharing,
        onEndMeetingSignal: socketEndMeeting,
        broadcastAudioState: async (isOn: boolean) => { socketBroadcastAudioState(isOn); },
        broadcastVideoState: async (isOn: boolean) => { socketBroadcastVideoState(isOn); },
        broadcastScreenShareState: async (isSharing: boolean) => { socketBroadcastScreenShareState(isSharing); },
    });

    // 同步 handleLeaveMeeting / handleEndMeetingCleanup 到 ref（避免循环依赖）
    useEffect(() => {
        leaveMeetingRef.current = handleLeaveMeeting;
        endMeetingCleanupRef.current = handleEndMeetingCleanup;
    }, [handleLeaveMeeting, handleEndMeetingCleanup]);

    const socketMemberIds = socketMembers.map((m) => m.userId).filter(Boolean);
    const recordingSubscribeUserIds = Array.from(new Set(
        socketMemberIds.length > 0 ? socketMemberIds : [currentUser.userId, ...remoteUsers]
    ));
    const recordingMemberCount = socketMemberIds.length > 0 ? socketMemberIds.length : remoteUsers.length + 1;

    // 录制 Hook
    const { isRecording, recordingTime, isStarting, isStopping, startRecording, stopRecording } = useRecording({
        roomId: roomId || '',
        memberCount: recordingMemberCount,
        subscribeUserIds: recordingSubscribeUserIds,
        onError: (error) => console.error('Recording error:', error),
    });

    const remoteParticipantIds = socketMembers
        .filter((member) => member.userId && member.userId !== currentUser.userId)
        .map((member) => member.userId);
    const memberAudioStates = socketMembers.reduce((acc, member) => {
        if (member.userId) {
            acc[member.userId] = member.isAudioOn;
        }
        return acc;
    }, {} as Record<string, boolean>);
    const socketVideoUserIds = socketMembers
        .filter((member) => member.isVideoOn && member.userId)
        .map((member) => member.userId);

    // Socket 为唯一状态源，TRTC 状态变化通过回调触发重同步
    const { registerRemoteVideo } = useRemoteVideo({
        remoteUsers,
        availableUsers: socketVideoUserIds,
        startRemoteVideo,
        stopRemoteVideo,
    });

    // 当 TRTC 已看到远端用户但 Socket 未同步时触发重同步
    useEffect(() => {
        if (remoteUsers.length === 0 && remoteVideoAvailableUsers.length === 0) return;
        const missingMembers = remoteUsers.filter((userId) => !socketMemberIds.includes(userId));
        const videoMismatch = remoteVideoAvailableUsers.filter((userId) => !socketVideoUserIds.includes(userId));
        if (missingMembers.length === 0 && videoMismatch.length === 0) return;
        const now = Date.now();
        if (now - lastRoomSyncRef.current < 2000) return;
        lastRoomSyncRef.current = now;
        requestRoomState();
    }, [remoteUsers, remoteVideoAvailableUsers, socketMemberIds, socketVideoUserIds, requestRoomState]);

    // 加入会议时检测录制状态，显示提示
    useEffect(() => {
        if (!hasShownRecordingNotice && socketIsRecording) {
            addToast(
                t('recording.meetingIsRecording', '会议正在录制中，您的音视频将被记录'),
                'warning',
                5000
            );
            setHasShownRecordingNotice(true);
        }
    }, [socketIsRecording, hasShownRecordingNotice, addToast, t]);

    // 加载状态：等待用户身份验证
    const isLoading = !currentUser.userSig || currentUser.userId.startsWith('guest_');

    // 成员状态心跳（轻量级同步）
    useEffect(() => {
        if (!roomId) return;
        const sendState = () => {
            reportMemberState({
                isAudioOn: isMicOn,
                isVideoOn: isCameraOn,
                isScreenSharing,
                isHandRaised,
            });
        };

        sendState();
        const intervalId = window.setInterval(sendState, 30000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [roomId, isMicOn, isCameraOn, isScreenSharing, isHandRaised, reportMemberState]);

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
                        isRoomRecording={socketIsRecording}
                        recordingTime={recordingTime}
                        isHost={socketCanControl}
                        isStarting={isStarting}
                        isStopping={isStopping}
                        onStartRecording={async () => {
                            const taskId = await startRecording();
                            if (taskId) {
                                socketStartRecording(taskId);
                            }
                        }}
                        onStopRecording={async () => {
                            const stopped = await stopRecording();
                            if (stopped) {
                                socketStopRecording();
                            }
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
                        remoteUsers={remoteParticipantIds}
                        remoteUserNames={remoteUserNames}
                        memberAudioStates={memberAudioStates}
                        currentUserId={currentUser.userId}
                        currentUserName={currentUser.userName}
                        isCameraOn={isCameraOn}
                        isMicOn={isMicOn}
                        isScreenSharing={isScreenSharing}
                        screenShareUserId={screenShareUserId}
                        layout={layout}
                        registerRemoteVideo={registerRemoteVideo}
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
                        socketMembers={socketMembers}
                        currentUserId={currentUser.userId}
                        currentUserName={currentUser.userName}
                        hostId={socketHostId || currentUser.userId}
                        isHost={socketIsHost}
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
                memberCount={socketMembers.length || 1}
                unreadCount={unreadCount}
                isHandRaised={isHandRaised}
                onToggleHandRaise={() => {
                    const newState = !isHandRaised;
                    setIsHandRaised(newState);
                    socketBroadcastHandRaised(newState);
                    console.log(newState ? '✋ 举手' : '👇 放下手');
                }}
                isRecording={isRecording}
                isRoomRecording={socketIsRecording}
                recordingTime={recordingTime}
                isStarting={isStarting}
                isStopping={isStopping}
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
                        socketStartRecording(taskId);
                    }
                }}
                onStopRecording={async () => {
                    const stopped = await stopRecording();
                    if (stopped) {
                        socketStopRecording();
                    }
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
                meetingTitle={meetingTitle || t('home.title')}
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
                    endMeetingRequestedRef.current = true;
                    handleEndMeeting();
                }}
                onLeaveMeeting={handleLeaveMeeting}
                isHost={socketIsHost}
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
