// 智会 - TRTC React Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { trtcService } from '@/services/trtc';
import type { TRTCConfig, NetworkQuality } from '@/types';

export interface RemoteUserState {
    userId: string;
    hasAudio: boolean;
    hasVideo: boolean;
    hasScreenShare: boolean;
}

export interface UseTRTCOptions {
    onError?: (error: Error) => void;
}

export interface UseTRTCReturn {
    // 状态
    isJoined: boolean;
    isAudioOn: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    networkQuality: NetworkQuality;
    remoteUsers: string[];
    screenShareUserId: string | null; // 谁在共享屏幕

    // 房间操作
    joinRoom: (config: TRTCConfig) => Promise<void>;
    leaveRoom: () => Promise<void>;

    // 本地音视频
    toggleAudio: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    startLocalVideo: (view: string | HTMLElement) => Promise<void>;
    stopLocalVideo: () => Promise<void>;

    // 屏幕共享
    startScreenShare: (view?: string | HTMLElement) => Promise<void>;
    stopScreenShare: () => Promise<void>;
    updateScreenShare: (view: string | HTMLElement) => Promise<void>;

    // 远程视频
    startRemoteVideo: (userId: string, view: string | HTMLElement, isSub?: boolean) => Promise<void>;
    stopRemoteVideo: (userId: string, isSub?: boolean) => Promise<void>;
}

export function useTRTC(options: UseTRTCOptions = {}): UseTRTCReturn {
    const [isJoined, setIsJoined] = useState(false);
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
    const [remoteUsers, setRemoteUsers] = useState<string[]>([]);
    const [screenShareUserId, setScreenShareUserId] = useState<string | null>(null);

    const initialized = useRef(false);

    // 初始化并设置事件监听
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const init = async () => {
            await trtcService.init();

            // 设置事件回调
            trtcService.on('onRemoteUserEnter', (userId) => {
                setRemoteUsers((prev) => [...prev.filter((id) => id !== userId), userId]);
            });

            trtcService.on('onRemoteUserLeave', (userId) => {
                setRemoteUsers((prev) => prev.filter((id) => id !== userId));
                // 如果离开的用户正在共享屏幕，清除共享状态
                setScreenShareUserId((prev) => prev === userId ? null : prev);
            });

            // 监听远程视频可用（包括主视频流和屏幕共享）
            trtcService.on('onRemoteVideoAvailable', (userId, streamType) => {
                console.log('📹 远程视频可用:', userId, '类型:', streamType);

                if (streamType === 'sub' || streamType === 'auxiliary') {
                    // 远程用户开始共享屏幕
                    setScreenShareUserId(userId);
                } else {
                    // 主视频流可用，尝试自动订阅
                    const element = document.getElementById(`remote-video-${userId}`);
                    if (element) {
                        console.log('📹 自动订阅远程视频:', userId);
                        trtcService.startRemoteVideo(userId, element).catch((err) => {
                            console.error('自动订阅远程视频失败:', err);
                        });
                    } else {
                        console.warn('📹 未找到远程视频容器:', `remote-video-${userId}`);
                    }
                }
            });

            trtcService.on('onRemoteVideoUnavailable', (userId, streamType) => {
                console.log('📹 远程视频不可用:', userId, '类型:', streamType);
                if (streamType === 'sub' || streamType === 'auxiliary') {
                    // 远程用户停止共享屏幕
                    setScreenShareUserId((prev) => prev === userId ? null : prev);
                }
            });

            trtcService.on('onNetworkQuality', (quality) => {
                setNetworkQuality(quality);
            });

            trtcService.on('onKickedOut', () => {
                setIsJoined(false);
                setRemoteUsers([]);
                setScreenShareUserId(null);
            });

            trtcService.on('onError', (error) => {
                options.onError?.(error);
            });
        };

        init();

        return () => {
            // 清理
            trtcService.off('onRemoteUserEnter');
            trtcService.off('onRemoteUserLeave');
            trtcService.off('onRemoteVideoAvailable');
            trtcService.off('onRemoteVideoUnavailable');
            trtcService.off('onNetworkQuality');
            trtcService.off('onKickedOut');
            trtcService.off('onError');
        };
    }, [options]);

    // 加入房间
    const joinRoom = useCallback(async (config: TRTCConfig) => {
        await trtcService.enterRoom(config);
        setIsJoined(true);
    }, []);

    // 离开房间
    const leaveRoom = useCallback(async () => {
        await trtcService.exitRoom();
        setIsJoined(false);
        setIsAudioOn(false);
        setIsVideoOn(false);
        setIsScreenSharing(false);
        setRemoteUsers([]);
        setNetworkQuality('unknown');
    }, []);

    // 切换音频
    const toggleAudio = useCallback(async () => {
        try {
            if (isAudioOn) {
                await trtcService.stopLocalAudio();
                setIsAudioOn(false);
            } else {
                await trtcService.startLocalAudio();
                setIsAudioOn(true);
            }
        } catch (error: unknown) {
            // 忽略 "already started" 或 "already stopped" 错误
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('already started')) {
                setIsAudioOn(true);  // 同步状态
            } else if (errorMsg.includes('already stopped')) {
                setIsAudioOn(false); // 同步状态
            } else {
                throw error;
            }
        }
    }, [isAudioOn]);

    // 切换视频
    const toggleVideo = useCallback(async () => {
        if (isVideoOn) {
            await trtcService.stopLocalVideo();
            setIsVideoOn(false);
        } else {
            // 注意：需要提供 view 元素
            setIsVideoOn(true);
        }
    }, [isVideoOn]);

    // 开启本地视频
    const startLocalVideo = useCallback(async (view: string | HTMLElement) => {
        await trtcService.startLocalVideo(view);
        setIsVideoOn(true);
    }, []);

    // 关闭本地视频
    const stopLocalVideo = useCallback(async () => {
        await trtcService.stopLocalVideo();
        setIsVideoOn(false);
    }, []);

    // 开始屏幕共享
    const startScreenShare = useCallback(async (view?: string | HTMLElement) => {
        await trtcService.startScreenShare(view);
        setIsScreenSharing(true);
    }, []);

    // 停止屏幕共享
    const stopScreenShare = useCallback(async () => {
        await trtcService.stopScreenShare();
        setIsScreenSharing(false);
    }, []);

    // 更新屏幕共享预览
    const updateScreenShare = useCallback(async (view: string | HTMLElement) => {
        await trtcService.updateScreenShare(view);
    }, []);

    // 播放远程视频
    const startRemoteVideo = useCallback(async (userId: string, view: string | HTMLElement) => {
        await trtcService.startRemoteVideo(userId, view);
    }, []);

    // 停止远程视频
    const stopRemoteVideo = useCallback(async (userId: string) => {
        await trtcService.stopRemoteVideo(userId);
    }, []);

    return {
        isJoined,
        isAudioOn,
        isVideoOn,
        isScreenSharing,
        networkQuality,
        remoteUsers,
        screenShareUserId,
        joinRoom,
        leaveRoom,
        toggleAudio,
        toggleVideo,
        startLocalVideo,
        stopLocalVideo,
        startScreenShare,
        stopScreenShare,
        updateScreenShare,
        startRemoteVideo,
        stopRemoteVideo,
    };
}

export default useTRTC;
