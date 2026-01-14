// 智会 - 房间状态管理 Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { imService, type RoomStateEvent } from '@/services/im';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

// 后端 API 基础 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30000;

// 房间状态类型
export interface RoomState {
    // 主持人
    hostId: string;

    // 录制状态
    recording: {
        isRecording: boolean;
        taskId?: string;
        startedBy?: string;
        startedAt?: number;
    };

    // 成员状态（从后端同步）
    members: Array<{
        userId: string;
        userName: string;
        role: 'host' | 'cohost' | 'member';
        isMuted: boolean;
        isCameraOff: boolean;
    }>;
}

export interface UseRoomStateOptions {
    meetingId: string;
    userId: string;
    onRecordingChange?: (isRecording: boolean) => void;
    onHostChange?: (newHostId: string) => void;
    onMeetingEnd?: () => void;  // 会议结束回调
    onMemberAudioChange?: (userId: string, isAudioOn: boolean) => void;
    onMemberVideoChange?: (userId: string, isVideoOn: boolean) => void;
    onMemberNameChange?: (userId: string, newName: string) => void;
    onMemberScreenShareChange?: (userId: string, isSharing: boolean) => void;
}

export interface UseRoomStateReturn {
    roomState: RoomState;
    isHost: boolean;
    isCohost: boolean;
    canControl: boolean;  // 主持人或联席主持人
    memberStates: Map<string, MemberMediaState>;  // 成员媒体状态

    // 状态操作
    refreshState: () => Promise<void>;

    // 广播操作（仅主持人/联席主持人可用）
    broadcastRecordingStart: (taskId: string) => Promise<void>;
    broadcastRecordingStop: () => Promise<void>;
    broadcastMeetingEnd: () => Promise<void>;
    broadcastAudioState: (isAudioOn: boolean) => Promise<void>;
    broadcastVideoState: (isVideoOn: boolean) => Promise<void>;
    broadcastNameChange: (newName: string) => Promise<void>;
    broadcastScreenShareState: (isSharing: boolean) => Promise<void>;
}

// 成员媒体状态
export interface MemberMediaState {
    isAudioOn: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    displayName?: string;
}

const defaultRoomState: RoomState = {
    hostId: '',
    recording: { isRecording: false },
    members: [],
};

export function useRoomState(options: UseRoomStateOptions): UseRoomStateReturn {
    const {
        meetingId,
        userId,
        onRecordingChange,
        onHostChange,
        onMeetingEnd,
        onMemberAudioChange,
        onMemberVideoChange,
        onMemberNameChange,
        onMemberScreenShareChange,
    } = options;

    const [roomState, setRoomState] = useState<RoomState>(defaultRoomState);
    const [memberStates, setMemberStates] = useState<Map<string, MemberMediaState>>(new Map());
    const callbacksRef = useRef({
        onRecordingChange,
        onHostChange,
        onMeetingEnd,
        onMemberAudioChange,
        onMemberVideoChange,
        onMemberNameChange,
        onMemberScreenShareChange,
    });

    // 更新 ref
    useEffect(() => {
        callbacksRef.current = {
            onRecordingChange,
            onHostChange,
            onMeetingEnd,
            onMemberAudioChange,
            onMemberVideoChange,
            onMemberNameChange,
            onMemberScreenShareChange,
        };
    }, [onRecordingChange, onHostChange, onMeetingEnd, onMemberAudioChange, onMemberVideoChange, onMemberNameChange, onMemberScreenShareChange]);

    // 从后端获取房间状态
    const refreshState = useCallback(async () => {
        try {
            const response = await fetchWithTimeout(`${API_URL}/api/meetings/${meetingId}/state`, {}, DEFAULT_TIMEOUT);
            const result = await response.json();

            if (result.success && result.data) {
                const { meeting, members, recording } = result.data;
                setRoomState({
                    hostId: meeting.hostId,
                    recording: recording ? {
                        isRecording: recording.status === 'recording',
                        taskId: recording.id,
                        startedBy: recording.startedBy,
                        startedAt: recording.startedAt,
                    } : { isRecording: false },
                    members: members.map((m: { userId: string; userName: string; role: string; isMuted: number; isCameraOff: number }) => ({
                        userId: m.userId,
                        userName: m.userName,
                        role: m.role as 'host' | 'cohost' | 'member',
                        isMuted: !!m.isMuted,
                        isCameraOff: !!m.isCameraOff,
                    })),
                });
            }
        } catch (error) {
            console.error('Failed to refresh room state:', error);
        }
    }, [meetingId]);

    // 处理房间状态事件
    const handleRoomStateEvent = useCallback((event: RoomStateEvent) => {
        console.log('🔔 房间状态事件:', event.type, event.data);

        switch (event.type) {
            case 'RECORDING_STARTED':
                setRoomState(prev => ({
                    ...prev,
                    recording: {
                        isRecording: true,
                        taskId: event.data.taskId as string,
                        startedBy: event.data.startedBy as string,
                        startedAt: event.data.startedAt as number,
                    },
                }));
                callbacksRef.current.onRecordingChange?.(true);
                break;

            case 'RECORDING_STOPPED':
                setRoomState(prev => ({
                    ...prev,
                    recording: { isRecording: false },
                }));
                callbacksRef.current.onRecordingChange?.(false);
                break;

            case 'HOST_CHANGED':
                setRoomState(prev => ({
                    ...prev,
                    hostId: event.data.newHostId as string,
                }));
                callbacksRef.current.onHostChange?.(event.data.newHostId as string);
                break;

            case 'MEMBER_MUTED':
            case 'MEMBER_UNMUTED':
            case 'MEMBER_CAMERA_ON':
            case 'MEMBER_CAMERA_OFF':
                // 刷新成员列表
                refreshState();
                break;

            case 'MEETING_ENDED':
                // 会议被主持人结束
                console.log('🔔 收到会议结束通知');
                callbacksRef.current.onMeetingEnd?.();
                break;

            // 音频状态变更
            case 'MEMBER_AUDIO_ON':
            case 'MEMBER_AUDIO_OFF':
                {
                    const memberId = event.data.userId as string;
                    const isAudioOn = event.type === 'MEMBER_AUDIO_ON';
                    setMemberStates(prev => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(memberId) || { isAudioOn: false, isVideoOn: false, isScreenSharing: false };
                        newMap.set(memberId, { ...existing, isAudioOn });
                        return newMap;
                    });
                    callbacksRef.current.onMemberAudioChange?.(memberId, isAudioOn);
                }
                break;

            // 视频状态变更
            case 'MEMBER_VIDEO_ON':
            case 'MEMBER_VIDEO_OFF':
                {
                    const memberId = event.data.userId as string;
                    const isVideoOn = event.type === 'MEMBER_VIDEO_ON';
                    setMemberStates(prev => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(memberId) || { isAudioOn: false, isVideoOn: false, isScreenSharing: false };
                        newMap.set(memberId, { ...existing, isVideoOn });
                        return newMap;
                    });
                    callbacksRef.current.onMemberVideoChange?.(memberId, isVideoOn);
                }
                break;

            // 名称变更
            case 'MEMBER_NAME_CHANGED':
                {
                    const memberId = event.data.userId as string;
                    const newName = event.data.newName as string;
                    setMemberStates(prev => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(memberId) || { isAudioOn: false, isVideoOn: false, isScreenSharing: false };
                        newMap.set(memberId, { ...existing, displayName: newName });
                        return newMap;
                    });
                    callbacksRef.current.onMemberNameChange?.(memberId, newName);
                }
                break;

            // 屏幕共享状态变更
            case 'MEMBER_SCREEN_SHARE_ON':
            case 'MEMBER_SCREEN_SHARE_OFF':
                {
                    const memberId = event.data.userId as string;
                    const isSharing = event.type === 'MEMBER_SCREEN_SHARE_ON';
                    setMemberStates(prev => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(memberId) || { isAudioOn: false, isVideoOn: false, isScreenSharing: false };
                        newMap.set(memberId, { ...existing, isScreenSharing: isSharing });
                        return newMap;
                    });
                    callbacksRef.current.onMemberScreenShareChange?.(memberId, isSharing);
                }
                break;
        }
    }, [refreshState]);

    // 注册 IM 事件监听
    useEffect(() => {
        imService.on('onCustomMessage', handleRoomStateEvent);

        return () => {
            imService.off('onCustomMessage');
        };
    }, [handleRoomStateEvent]);

    // 初始加载
    useEffect(() => {
        if (meetingId) {
            refreshState();
        }
    }, [meetingId, refreshState]);

    // 广播录制开始
    const broadcastRecordingStart = useCallback(async (taskId: string) => {
        const now = Math.floor(Date.now() / 1000);

        // 先更新本地状态
        setRoomState(prev => ({
            ...prev,
            recording: {
                isRecording: true,
                taskId,
                startedBy: userId,
                startedAt: now,
            },
        }));

        // 广播给其他用户
        await imService.broadcastRecordingState(true, {
            taskId,
            startedBy: userId,
            startedAt: now,
        });
    }, [userId]);

    // 广播录制停止
    const broadcastRecordingStop = useCallback(async () => {
        // 先更新本地状态
        setRoomState(prev => ({
            ...prev,
            recording: { isRecording: false },
        }));

        // 广播给其他用户
        await imService.broadcastRecordingState(false);
    }, []);

    // 广播会议结束
    const broadcastMeetingEnd = useCallback(async () => {
        // 广播给其他用户
        await imService.sendCustomMessage({
            type: 'MEETING_ENDED',
            data: { endedBy: userId },
            timestamp: Date.now(),
        });
    }, [userId]);

    // 广播音频状态
    const broadcastAudioState = useCallback(async (isAudioOn: boolean) => {
        await imService.broadcastAudioState(userId, isAudioOn);
    }, [userId]);

    // 广播视频状态
    const broadcastVideoState = useCallback(async (isVideoOn: boolean) => {
        await imService.broadcastVideoState(userId, isVideoOn);
    }, [userId]);

    // 广播名称变更
    const broadcastNameChange = useCallback(async (newName: string) => {
        await imService.broadcastNameChange(userId, newName);
    }, [userId]);

    // 广播屏幕共享状态
    const broadcastScreenShareState = useCallback(async (isSharing: boolean) => {
        await imService.broadcastScreenShareState(userId, isSharing);
    }, [userId]);

    // 计算权限
    const currentMember = roomState.members.find(m => m.userId === userId);
    const isHost = roomState.hostId === userId;
    const isCohost = currentMember?.role === 'cohost';
    const canControl = isHost || isCohost;

    return {
        roomState,
        isHost,
        isCohost,
        canControl,
        memberStates,
        refreshState,
        broadcastRecordingStart,
        broadcastRecordingStop,
        broadcastMeetingEnd,
        broadcastAudioState,
        broadcastVideoState,
        broadcastNameChange,
        broadcastScreenShareState,
    };
}

export default useRoomState;
