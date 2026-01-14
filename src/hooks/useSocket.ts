// 智会 - Socket 状态管理 Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService, type RoomState, type MemberState } from '@/services/socket';

export interface UseSocketOptions {
    userId: string;
    userName?: string;
    meetingId: string;
    autoConnect?: boolean;
    onKicked?: (forever: boolean) => void;
    onMeetingEnded?: () => void;
    onMutedByHost?: (by: string) => void;
    onVideoStoppedByHost?: (by: string) => void;
}

export interface UseSocketReturn {
    // 连接状态
    isConnected: boolean;

    // 房间状态
    roomState: RoomState | null;
    members: MemberState[];
    hostId: string;
    isHost: boolean;
    isCoHost: boolean;
    canControl: boolean;
    isLocked: boolean;
    isAllMuted: boolean;
    isRecording: boolean;

    // 操作方法
    connect: () => void;
    disconnect: () => void;
    joinRoom: () => void;
    leaveRoom: () => void;

    // 状态广播
    broadcastAudioState: (isOn: boolean) => void;
    broadcastVideoState: (isOn: boolean) => void;
    broadcastScreenShareState: (isSharing: boolean) => void;
    broadcastHandRaised: (isRaised: boolean) => void;

    // 主持人操作
    muteMember: (targetId: string) => void;
    stopVideoMember: (targetId: string) => void;
    kickMember: (targetId: string, forever?: boolean) => void;
    muteAll: (allowSelfUnmute?: boolean) => void;
    lockMeeting: (isLocked: boolean) => void;
    assignCoHost: (targetId: string) => void;
    transferHost: (newHostId: string) => void;
    endMeeting: () => void;

    // 录制操作
    startRecording: (taskId: string) => void;
    stopRecording: () => void;
}

export function useSocket({
    userId,
    userName,
    meetingId,
    autoConnect = true,
    onKicked,
    onMeetingEnded,
    onMutedByHost,
    onVideoStoppedByHost,
}: UseSocketOptions): UseSocketReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [roomState, setRoomState] = useState<RoomState | null>(null);

    // 用 ref 避免回调中的闭包问题
    const callbacksRef = useRef({ onKicked, onMeetingEnded, onMutedByHost, onVideoStoppedByHost });
    useEffect(() => {
        callbacksRef.current = { onKicked, onMeetingEnded, onMutedByHost, onVideoStoppedByHost };
    }, [onKicked, onMeetingEnded, onMutedByHost, onVideoStoppedByHost]);

    // 设置回调
    useEffect(() => {
        socketService.setCallbacks({
            onConnect: () => setIsConnected(true),
            onDisconnect: () => setIsConnected(false),

            onRoomState: (state) => {
                console.log('🏠 房间状态更新:', state);
                setRoomState(state);
            },

            onMemberJoined: (member) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    // 避免重复添加
                    if (prev.members.some(m => m.userId === member.userId)) {
                        return prev;
                    }
                    return {
                        ...prev,
                        members: [...prev.members, member],
                    };
                });
            },

            onMemberLeft: ({ userId: leftUserId }) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        members: prev.members.filter(m => m.userId !== leftUserId),
                    };
                });
            },

            onMemberUpdated: (data) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        members: prev.members.map(m =>
                            m.userId === data.userId ? { ...m, ...data } : m
                        ),
                    };
                });
            },

            onMemberKicked: ({ userId: kickedId }) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        members: prev.members.filter(m => m.userId !== kickedId),
                    };
                });
            },

            onMemberRoleChanged: ({ userId: targetId, role }) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        members: prev.members.map(m =>
                            m.userId === targetId
                                ? { ...m, role: role as MemberState['role'] }
                                : m
                        ),
                    };
                });
            },

            onRoomLocked: ({ isLocked }) => {
                setRoomState(prev => prev ? { ...prev, isLocked } : prev);
            },

            onRoomMutedAll: ({ allowSelfUnmute }) => {
                setRoomState(prev => prev ? {
                    ...prev,
                    isAllMuted: true,
                    allowSelfUnmute,
                } : prev);
            },

            onRoomHostChanged: ({ oldHostId, newHostId }) => {
                setRoomState(prev => {
                    if (!prev) return prev;
                    // 更新 hostId 和成员角色
                    const updatedMembers = prev.members.map(m => {
                        if (m.userId === newHostId) {
                            return { ...m, role: 'host' as const };
                        }
                        if (m.userId === oldHostId) {
                            return { ...m, role: 'member' as const };
                        }
                        return m;
                    });
                    return { ...prev, hostId: newHostId, members: updatedMembers };
                });
            },

            onRoomEnded: () => {
                callbacksRef.current.onMeetingEnded?.();
            },

            onRecordingStarted: ({ taskId, by }) => {
                setRoomState(prev => prev ? {
                    ...prev,
                    recording: { isRecording: true, taskId, startedBy: by },
                } : prev);
            },

            onRecordingStopped: () => {
                setRoomState(prev => prev ? {
                    ...prev,
                    recording: { isRecording: false },
                } : prev);
            },

            onYouKicked: ({ forever }) => {
                callbacksRef.current.onKicked?.(forever);
            },

            onYouMuted: ({ by }) => {
                console.log('🔇 你被主持人静音:', by);
                callbacksRef.current.onMutedByHost?.(by);
            },

            onYouVideoStopped: ({ by }) => {
                console.log('📹 你的视频被主持人关闭:', by);
                callbacksRef.current.onVideoStoppedByHost?.(by);
            },

            onError: ({ message }) => {
                console.error('Socket 错误:', message);
            },
        });
    }, []);

    // 自动连接
    useEffect(() => {
        if (autoConnect && userId && meetingId) {
            socketService.connect(userId, userName);
        }

        return () => {
            // 组件卸载时不自动断开，由 Meeting 页面控制
        };
    }, [autoConnect, userId, userName, meetingId]);

    // 连接后自动加入房间
    useEffect(() => {
        if (isConnected && meetingId) {
            socketService.joinRoom(meetingId, userName);
        }
    }, [isConnected, meetingId, userName]);

    // 计算派生状态
    const members = roomState?.members ?? [];
    const hostId = roomState?.hostId ?? '';
    const isHost = userId === hostId;
    const myRole = members.find(m => m.userId === userId)?.role;
    const isCoHost = myRole === 'cohost';
    const canControl = isHost || isCoHost;
    const isLocked = roomState?.isLocked ?? false;
    const isAllMuted = roomState?.isAllMuted ?? false;
    const isRecording = roomState?.recording?.isRecording ?? false;

    // 操作方法
    const connect = useCallback(() => {
        socketService.connect(userId, userName);
    }, [userId, userName]);

    const disconnect = useCallback(() => {
        socketService.disconnect();
    }, []);

    const joinRoom = useCallback(() => {
        socketService.joinRoom(meetingId, userName);
    }, [meetingId, userName]);

    const leaveRoom = useCallback(() => {
        socketService.leaveRoom();
    }, []);

    // 状态广播
    const broadcastAudioState = useCallback((isOn: boolean) => {
        socketService.broadcastAudioState(isOn);
    }, []);

    const broadcastVideoState = useCallback((isOn: boolean) => {
        socketService.broadcastVideoState(isOn);
    }, []);

    const broadcastScreenShareState = useCallback((isSharing: boolean) => {
        socketService.broadcastScreenShareState(isSharing);
    }, []);

    const broadcastHandRaised = useCallback((isRaised: boolean) => {
        socketService.broadcastHandRaised(isRaised);
    }, []);

    // 主持人操作
    const muteMember = useCallback((targetId: string) => {
        socketService.muteMember(targetId);
    }, []);

    const stopVideoMember = useCallback((targetId: string) => {
        socketService.stopVideoMember(targetId);
    }, []);

    const kickMember = useCallback((targetId: string, forever = false) => {
        socketService.kickMember(targetId, forever);
    }, []);

    const muteAll = useCallback((allowSelfUnmute = true) => {
        socketService.muteAll(allowSelfUnmute);
    }, []);

    const lockMeeting = useCallback((locked: boolean) => {
        socketService.lockMeeting(locked);
    }, []);

    const assignCoHost = useCallback((targetId: string) => {
        socketService.assignCoHost(targetId);
    }, []);

    const transferHost = useCallback((newHostId: string) => {
        socketService.transferHost(newHostId);
    }, []);

    const endMeeting = useCallback(() => {
        socketService.endMeeting();
    }, []);

    // 录制操作
    const startRecording = useCallback((taskId: string) => {
        socketService.startRecording(taskId);
    }, []);

    const stopRecording = useCallback(() => {
        socketService.stopRecording();
    }, []);

    return {
        isConnected,
        roomState,
        members,
        hostId,
        isHost,
        isCoHost,
        canControl,
        isLocked,
        isAllMuted,
        isRecording,
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        broadcastAudioState,
        broadcastVideoState,
        broadcastScreenShareState,
        broadcastHandRaised,
        muteMember,
        stopVideoMember,
        kickMember,
        muteAll,
        lockMeeting,
        assignCoHost,
        transferHost,
        endMeeting,
        startRecording,
        stopRecording,
    };
}

export default useSocket;
