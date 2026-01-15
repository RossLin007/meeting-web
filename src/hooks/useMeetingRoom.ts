// 智会 - 会议室核心逻辑 Hook

import { useEffect, useRef, useCallback } from 'react';
// 注意：直接导入而非从 index 导入，避免循环依赖
import { useTRTC } from './useTRTC';
import { useIM } from './useIM';
import { useRoomState } from './useRoomState';
import { useMeetingStore } from '@/services/store';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { validateRoomId, validateUserId } from '@/utils/urlValidation';

const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SDK_APP_ID = Number(import.meta.env.VITE_TRTC_SDK_APP_ID);

export interface UseMeetingRoomOptions {
    roomId: string | undefined;
    urlUserId: string | null;
    showChat: boolean;
    isCameraOn: boolean;
    isMicOn: boolean;
    localVideoRef: React.RefObject<HTMLDivElement | null>;
    onMeetingEnd?: () => void;
    onUnreadCountChange?: (count: number) => void;
}

export interface UseMeetingRoomReturn {
    // 状态
    isJoined: boolean;
    isHost: boolean;
    canControl: boolean;
    remoteUsers: string[];
    remoteUserNames: Record<string, string>;
    networkQuality: ReturnType<typeof useTRTC>['networkQuality'];
    screenShareUserId: string | null;
    roomState: ReturnType<typeof useRoomState>['roomState'];

    // IM 状态
    isJoinedGroup: boolean;
    unreadCount: number;
    messages: ReturnType<typeof useIM>['messages'];

    // 录制状态
    isRecording: boolean;
    recordingTime: number;

    // 操作方法
    toggleCamera: () => Promise<void>;
    toggleMic: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    updateScreenShare: (element: HTMLDivElement) => void;
    sendMessage: (content: string) => Promise<void>;
    sendImage: (file: File) => Promise<void>;
    sendFile: (file: File) => Promise<void>;
    loadHistory: () => Promise<void>;
    startRecording: () => Promise<string | undefined>;
    stopRecording: () => Promise<void>;
    broadcastRecordingStart: (taskId: string) => Promise<void>;
    broadcastRecordingStop: () => Promise<void>;
    broadcastMeetingEnd: () => Promise<void>;
    leaveMeeting: () => void;
    endMeeting: () => Promise<void>;
    refreshState: () => Promise<void>;
}

export function useMeetingRoom({
    roomId,
    urlUserId,
    showChat,
    isCameraOn,
    isMicOn,
    localVideoRef,
    onMeetingEnd,
    onUnreadCountChange,
}: UseMeetingRoomOptions): UseMeetingRoomReturn {
    const { currentUser, setCurrentUser, reset } = useMeetingStore();
    const remoteUserNamesRef = useRef<Record<string, string>>({});
    const activeRemoteStreams = useRef<Set<string>>(new Set());

    // 验证 roomId
    const roomIdValidation = validateRoomId(roomId);
    if (!roomIdValidation.valid && roomId) {
        console.error('❌ roomId 验证失败:', roomIdValidation.error);
    }

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

    // IM Hook
    const {
        isJoinedGroup,
        unreadCount,
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
        isChatVisible: showChat,
        onUnreadCountChange: (count) => onUnreadCountChange?.(count),
    });

    // 房间状态 Hook
    const {
        roomState,
        isHost,
        canControl,
        broadcastRecordingStart,
        broadcastRecordingStop,
        broadcastMeetingEnd,
        refreshState,
    } = useRoomState({
        meetingId: roomId || '',
        userId: currentUser.userId,
        onRecordingChange: (isRecording) => {
            console.log('🔔 录制状态变更:', isRecording);
        },
        onMeetingEnd: () => {
            console.log('🔔 会议已被主持人结束');
            onMeetingEnd?.();
        },
    });

    // 录制状态 - 默认值（录制功能由 Meeting.tsx 中的 useRecording hook 管理）
    const isRecording = false;
    const recordingTime = 0;
    const startRecording = async (): Promise<string | undefined> => undefined;
    const stopRecording = async (): Promise<void> => { };

    // 从 URL 参数恢复用户身份
    useEffect(() => {
        const userIdValidation = validateUserId(urlUserId);

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
    }, [urlUserId, setCurrentUser, currentUser.userId]);

    // 加入房间
    useEffect(() => {
        if (!roomId || isJoined) return;
        if (!currentUser.userSig || currentUser.userId.startsWith('guest_')) {
            console.log('⏳ 等待用户身份恢复...', currentUser.userId);
            return;
        }

        const join = async () => {
            try {
                console.log('🚀 加入 TRTC 房间:', roomId, '用户:', currentUser.userId);
                await joinRoom({
                    sdkAppId: SDK_APP_ID,
                    userId: currentUser.userId,
                    userSig: currentUser.userSig,
                    roomId: parseInt(roomId, 10),
                });

                console.log('✅ 会议加入完成');

                // 登录 IM 并加入群组
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
            leaveRoom();
            leaveGroup();
            reset();
        };
    }, [roomId]);

    // 处理远程用户视频
    useEffect(() => {
        const currentUsers = new Set(remoteUsers);

        remoteUsers.forEach((userId) => {
            if (!activeRemoteStreams.current.has(userId)) {
                const element = document.getElementById(`remote-video-${userId}`);
                if (element) {
                    startRemoteVideo(userId, element);
                    activeRemoteStreams.current.add(userId);
                }
            }
        });

        // 清理离开用户的流
        activeRemoteStreams.current.forEach((userId) => {
            if (!currentUsers.has(userId)) {
                console.log('🧹 清理离开用户的视频流:', userId);
                activeRemoteStreams.current.delete(userId);
            }
        });
    }, [remoteUsers, startRemoteVideo]);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (isCameraOn) {
            await stopLocalVideo();
        } else if (localVideoRef.current) {
            await startLocalVideo(localVideoRef.current);
        }
    }, [isCameraOn, localVideoRef, startLocalVideo, stopLocalVideo]);

    // 切换麦克风
    const toggleMic = useCallback(async () => {
        await toggleAudio();
    }, [toggleAudio]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (screenShareUserId) {
            await stopScreenShare();
        } else {
            await startScreenShare();
        }
    }, [screenShareUserId, startScreenShare, stopScreenShare]);

    // 离开会议
    const leaveMeeting = useCallback(() => {
        leaveRoom();
        leaveGroup();
        reset();
    }, [leaveRoom, leaveGroup, reset]);

    // 结束会议
    const endMeeting = useCallback(async () => {
        try {
            await broadcastMeetingEnd();
            await fetchWithTimeout(`${API_BASE_URL}/api/meetings/${roomId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.userId }),
            }, DEFAULT_TIMEOUT);
            console.log('✅ 会议已结束');
        } catch (error) {
            console.error('❌ 结束会议失败:', error);
        }
        leaveMeeting();
    }, [broadcastMeetingEnd, roomId, currentUser.userId, leaveMeeting]);

    return {
        // 状态
        isJoined,
        isHost,
        canControl,
        remoteUsers,
        remoteUserNames: remoteUserNamesRef.current,
        networkQuality,
        screenShareUserId,
        roomState,

        // IM 状态
        isJoinedGroup,
        unreadCount,
        messages,

        // 录制状态
        isRecording,
        recordingTime,

        // 操作方法
        toggleCamera,
        toggleMic,
        toggleScreenShare,
        updateScreenShare,
        sendMessage,
        sendImage,
        sendFile,
        loadHistory,
        startRecording,
        stopRecording,
        broadcastRecordingStart,
        broadcastRecordingStop,
        broadcastMeetingEnd,
        leaveMeeting,
        endMeeting,
        refreshState,
    };
}

export default useMeetingRoom;
