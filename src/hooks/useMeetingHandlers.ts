// 智会 - 会议室事件处理 Hooks

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface UseMeetingHandlersOptions {
    roomId: string | undefined;
    userId: string;
    localVideoRef: React.RefObject<HTMLDivElement | null>;
    screenShareRef: React.RefObject<HTMLDivElement | null>;

    // TRTC 方法
    startLocalVideo: (element: HTMLDivElement) => Promise<void>;
    stopLocalVideo: () => Promise<void>;
    toggleAudio: () => Promise<void>;
    startScreenShare: (element?: HTMLDivElement) => Promise<void>;
    stopScreenShare: () => Promise<void>;
    leaveRoom: () => Promise<void>;

    // IM 方法
    sendMessage: (text: string) => Promise<void>;
    sendImage: (file: File) => Promise<void>;
    sendFile: (file: File) => Promise<void>;
    leaveGroup: () => Promise<void>;

    // Store 方法
    setCameraOn: (on: boolean) => void;
    setMicOn: (on: boolean) => void;
    setScreenSharing: (sharing: boolean) => void;
    reset: () => void;

    // 当前状态
    isCameraOn: boolean;
    isMicOn: boolean;
    isScreenSharing: boolean;

    // 房间状态广播
    broadcastMeetingEnd?: () => Promise<void>;
    broadcastAudioState?: (isAudioOn: boolean) => Promise<void>;
    broadcastVideoState?: (isVideoOn: boolean) => Promise<void>;
    broadcastScreenShareState?: (isSharing: boolean) => Promise<void>;
}

export interface UseMeetingHandlersReturn {
    handleToggleCamera: () => Promise<void>;
    handleToggleMic: () => Promise<void>;
    handleToggleScreenShare: () => Promise<void>;
    handleToggleFullscreen: () => void;
    handleLeaveMeeting: () => Promise<void>;
    handleEndMeeting: () => Promise<void>;
    handleSendMessage: (text: string) => Promise<void>;
    handleSendImage: (file: File) => Promise<void>;
    handleSendFile: (file: File) => Promise<void>;
}

/**
 * 会议室事件处理 Hook
 * 封装所有用户交互的处理逻辑
 */
export function useMeetingHandlers({
    roomId,
    userId,
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
    broadcastAudioState,
    broadcastVideoState,
    broadcastScreenShareState,
}: UseMeetingHandlersOptions): UseMeetingHandlersReturn {
    const navigate = useNavigate();

    // 切换摄像头
    const handleToggleCamera = useCallback(async () => {
        try {
            if (isCameraOn) {
                await stopLocalVideo();
                setCameraOn(false);
                // 广播视频关闭
                if (broadcastVideoState) {
                    await broadcastVideoState(false);
                }
            } else if (localVideoRef.current) {
                await startLocalVideo(localVideoRef.current);
                setCameraOn(true);
                // 广播视频开启
                if (broadcastVideoState) {
                    await broadcastVideoState(true);
                }
            }
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('already started')) {
                setCameraOn(true);
            } else if (errorMsg.includes('already stopped')) {
                setCameraOn(false);
            } else {
                console.error('Toggle camera error:', error);
            }
        }
    }, [isCameraOn, startLocalVideo, stopLocalVideo, setCameraOn, localVideoRef, broadcastVideoState]);

    // 切换麦克风
    const handleToggleMic = useCallback(async () => {
        const newMicState = !isMicOn;
        await toggleAudio();
        setMicOn(newMicState);
        // 广播音频状态
        if (broadcastAudioState) {
            await broadcastAudioState(newMicState);
        }
    }, [isMicOn, toggleAudio, setMicOn, broadcastAudioState]);

    // 切换屏幕共享
    const handleToggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            await stopScreenShare();
            setScreenSharing(false);
            // 广播屏幕共享关闭
            if (broadcastScreenShareState) {
                await broadcastScreenShareState(false);
            }
        } else {
            try {
                await startScreenShare(screenShareRef.current || undefined);
                setScreenSharing(true);
                // 广播屏幕共享开启
                if (broadcastScreenShareState) {
                    await broadcastScreenShareState(true);
                }
            } catch (error) {
                console.log('Screen share cancelled or denied');
            }
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare, setScreenSharing, screenShareRef, broadcastScreenShareState]);

    // 切换全屏
    const handleToggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, []);

    // 离开会议
    const handleLeaveMeeting = useCallback(async () => {
        await leaveRoom();
        await leaveGroup();
        reset();
        navigate('/');
    }, [leaveRoom, leaveGroup, reset, navigate]);

    // 结束会议（仅主持人）
    const handleEndMeeting = useCallback(async () => {
        try {
            if (broadcastMeetingEnd) {
                await broadcastMeetingEnd();
            }
            await fetchWithTimeout(`${API_BASE_URL}/api/meetings/${roomId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            }, DEFAULT_TIMEOUT);
            console.log('✅ 会议已结束');
        } catch (error) {
            console.error('❌ 结束会议失败:', error);
        }
        await handleLeaveMeeting();
    }, [roomId, userId, broadcastMeetingEnd, handleLeaveMeeting]);

    // 发送消息
    const handleSendMessage = useCallback(async (text: string) => {
        await sendMessage(text);
    }, [sendMessage]);

    // 发送图片
    const handleSendImage = useCallback(async (file: File) => {
        await sendImage(file);
    }, [sendImage]);

    // 发送文件
    const handleSendFile = useCallback(async (file: File) => {
        await sendFile(file);
    }, [sendFile]);

    return {
        handleToggleCamera,
        handleToggleMic,
        handleToggleScreenShare,
        handleToggleFullscreen,
        handleLeaveMeeting,
        handleEndMeeting,
        handleSendMessage,
        handleSendImage,
        handleSendFile,
    };
}

export default useMeetingHandlers;
