// 智会 - TRTC 服务封装

import TRTC from 'trtc-sdk-v5';
import type { TRTCConfig, NetworkQuality } from '@/types';

// TRTC 配置（移除硬编码后备值）
const SDK_APP_ID = Number(import.meta.env.VITE_TRTC_SDK_APP_ID);
if (!SDK_APP_ID || isNaN(SDK_APP_ID)) {
    console.error('❌ 缺少 VITE_TRTC_SDK_APP_ID 配置');
}

// 事件类型
export type TRTCEventCallback = {
    onRemoteUserEnter: (userId: string) => void;
    onRemoteUserLeave: (userId: string) => void;
    onRemoteVideoAvailable: (userId: string, streamType: string) => void;
    onRemoteVideoUnavailable: (userId: string, streamType: string) => void;
    onRemoteAudioAvailable: (userId: string) => void;
    onRemoteAudioUnavailable: (userId: string) => void;
    onNetworkQuality: (quality: NetworkQuality) => void;
    onKickedOut: (reason: string) => void;
    onError: (error: Error) => void;
};

class TRTCService {
    private trtc: TRTC | null = null;
    private isInRoom = false;
    private currentRoomId: number | null = null;
    private callbacks: Partial<TRTCEventCallback> = {};

    // 初始化 TRTC 实例
    async init(): Promise<void> {
        if (this.trtc) {
            console.warn('TRTC already initialized');
            return;
        }

        this.trtc = TRTC.create();
        this.setupEventListeners();
        console.log('TRTC initialized');
    }

    // 设置事件监听
    private setupEventListeners(): void {
        if (!this.trtc) return;

        // 远程用户进入房间
        this.trtc.on(TRTC.EVENT.REMOTE_USER_ENTER, (event: { userId: string }) => {
            console.log('Remote user enter:', event.userId);
            this.callbacks.onRemoteUserEnter?.(event.userId);
        });

        // 远程用户离开房间
        this.trtc.on(TRTC.EVENT.REMOTE_USER_EXIT, (event: { userId: string }) => {
            console.log('Remote user exit:', event.userId);
            this.callbacks.onRemoteUserLeave?.(event.userId);
        });

        // 远程视频可用
        this.trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (event: { userId: string; streamType: string }) => {
            console.log('Remote video available:', event.userId, event.streamType);
            this.callbacks.onRemoteVideoAvailable?.(event.userId, event.streamType);
        });

        // 远程视频不可用
        this.trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, (event: { userId: string; streamType: string }) => {
            console.log('Remote video unavailable:', event.userId, event.streamType);
            this.callbacks.onRemoteVideoUnavailable?.(event.userId, event.streamType);
        });

        // 远程音频可用
        this.trtc.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, (event: { userId: string }) => {
            console.log('Remote audio available:', event.userId);
            this.callbacks.onRemoteAudioAvailable?.(event.userId);
        });

        // 远程音频不可用
        this.trtc.on(TRTC.EVENT.REMOTE_AUDIO_UNAVAILABLE, (event: { userId: string }) => {
            console.log('Remote audio unavailable:', event.userId);
            this.callbacks.onRemoteAudioUnavailable?.(event.userId);
        });

        // 网络质量
        this.trtc.on(TRTC.EVENT.NETWORK_QUALITY, (event: { uplinkNetworkQuality: number }) => {
            const qualityMap: Record<number, NetworkQuality> = {
                1: 'excellent',
                2: 'good',
                3: 'fair',
                4: 'poor',
                5: 'poor',
                6: 'unknown',
            };
            const quality = qualityMap[event.uplinkNetworkQuality] || 'unknown';
            this.callbacks.onNetworkQuality?.(quality);
        });

        // 被踢出房间
        this.trtc.on(TRTC.EVENT.KICKED_OUT, (event: { reason: string }) => {
            console.log('Kicked out:', event.reason);
            this.isInRoom = false;
            this.currentRoomId = null;
            this.callbacks.onKickedOut?.(event.reason);
        });

        // 错误
        this.trtc.on(TRTC.EVENT.ERROR, (event: { message: string }) => {
            console.error('TRTC error:', event.message);
            this.callbacks.onError?.(new Error(event.message));
        });
    }

    // 注册回调
    on<K extends keyof TRTCEventCallback>(event: K, callback: TRTCEventCallback[K]): void {
        this.callbacks[event] = callback;
    }

    // 移除回调
    off<K extends keyof TRTCEventCallback>(event: K): void {
        delete this.callbacks[event];
    }

    // 进入房间
    async enterRoom(config: TRTCConfig): Promise<void> {
        if (!this.trtc) {
            throw new Error('TRTC not initialized');
        }

        if (this.isInRoom) {
            console.warn('Already in room, skipping enterRoom');
            return;  // 直接返回，不重复进入
        }

        try {
            await this.trtc.enterRoom({
                sdkAppId: config.sdkAppId || SDK_APP_ID,
                userId: config.userId,
                userSig: config.userSig,
                roomId: config.roomId,
            });
            this.isInRoom = true;
            this.currentRoomId = config.roomId;
            console.log('Entered room:', config.roomId);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // 处理 "already start" 错误 - SDK 内部状态已经在房间中
            if (errorMsg.includes('already start') || errorMsg.includes('OPERATION_ABORT')) {
                console.warn('enterRoom aborted (already in room), syncing state');
                this.isInRoom = true;
                this.currentRoomId = config.roomId;
                return;
            }
            console.error('Failed to enter room:', error);
            throw error;
        }
    }

    // 退出房间
    async exitRoom(): Promise<void> {
        if (!this.trtc || !this.isInRoom) {
            return;
        }

        try {
            await this.trtc.exitRoom();
            this.isInRoom = false;
            this.currentRoomId = null;
            console.log('Exited room');
        } catch (error) {
            console.error('Failed to exit room:', error);
            throw error;
        }
    }

    // 开启本地视频
    async startLocalVideo(view: string | HTMLElement): Promise<void> {
        // 如果 TRTC 未初始化，自动初始化
        if (!this.trtc) {
            console.log('🔧 TRTC 未初始化，自动初始化...');
            await this.init();
        }

        try {
            await this.trtc!.startLocalVideo({ view });
            console.log('Local video started');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // 忽略 "already started" 错误
            if (errorMsg.includes('already started') || errorMsg.includes('already start')) {
                console.log('✅ 本地视频已经开启');
                return;
            }
            console.error('Failed to start local video:', error);
            throw error;
        }
    }

    // 关闭本地视频
    async stopLocalVideo(): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.stopLocalVideo();
            console.log('Local video stopped');
        } catch (error) {
            console.error('Failed to stop local video:', error);
            throw error;
        }
    }

    // 开启本地音频
    async startLocalAudio(): Promise<void> {
        if (!this.trtc) {
            throw new Error('TRTC not initialized');
        }

        try {
            await this.trtc.startLocalAudio();
            console.log('Local audio started');
        } catch (error) {
            console.error('Failed to start local audio:', error);
            throw error;
        }
    }

    // 关闭本地音频
    async stopLocalAudio(): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.stopLocalAudio();
            console.log('Local audio stopped');
        } catch (error) {
            console.error('Failed to stop local audio:', error);
            throw error;
        }
    }

    // 开始屏幕共享
    async startScreenShare(view?: string | HTMLElement, withSystemAudio = true): Promise<void> {
        if (!this.trtc) {
            throw new Error('TRTC not initialized');
        }

        try {
            // 配置屏幕共享，包含本地预览和系统音频
            const config: {
                view?: string | HTMLElement;
                option?: {
                    fillMode: 'contain' | 'cover' | 'fill';
                    systemAudio?: boolean;
                };
            } = {
                option: {
                    fillMode: 'contain',
                    systemAudio: withSystemAudio, // 共享系统声音
                },
            };

            if (view) {
                config.view = view;
            }

            await this.trtc.startScreenShare(config);
            console.log('Screen sharing started with view:', !!view, 'systemAudio:', withSystemAudio);
        } catch (error) {
            console.error('Failed to start screen share:', error);
            throw error;
        }
    }

    // 停止屏幕共享
    async stopScreenShare(): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.stopScreenShare();
            console.log('Screen sharing stopped');
        } catch (error) {
            console.error('Failed to stop screen share:', error);
            throw error;
        }
    }

    // 更新屏幕共享预览视图
    async updateScreenShare(view: string | HTMLElement): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.updateScreenShare({
                view,
                option: { fillMode: 'contain' },
            });
            console.log('Screen share view updated');
        } catch (error) {
            console.error('Failed to update screen share:', error);
            throw error;
        }
    }

    // 播放远程视频
    async startRemoteVideo(userId: string, view: string | HTMLElement, streamType = TRTC.TYPE.STREAM_TYPE_MAIN): Promise<boolean> {
        if (!this.trtc) {
            throw new Error('TRTC not initialized');
        }

        try {
            await this.trtc.startRemoteVideo({ userId, streamType, view });
            console.log('Remote video started:', userId);
            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // 远程用户尚未发布视频流或流未准备好
            if (errorMsg.includes('not publishing') || errorMsg.includes('INVALID_OPERATION')) {
                console.log('⏳ 远程用户尚未发布视频流:', userId);
                return false;
            }
            console.error('Failed to start remote video:', error);
            throw error;
        }
    }

    // 停止播放远程视频
    async stopRemoteVideo(userId: string, streamType = TRTC.TYPE.STREAM_TYPE_MAIN): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.stopRemoteVideo({ userId, streamType });
            console.log('Remote video stopped:', userId);
        } catch (error) {
            console.error('Failed to stop remote video:', error);
            throw error;
        }
    }

    // 静音/取消静音远程用户
    async muteRemoteAudio(userId: string, mute: boolean): Promise<void> {
        if (!this.trtc) return;

        try {
            await this.trtc.muteRemoteAudio(userId, mute);
            console.log(`Remote audio ${mute ? 'muted' : 'unmuted'}:`, userId);
        } catch (error) {
            console.error('Failed to mute remote audio:', error);
            throw error;
        }
    }

    // 获取当前房间 ID
    getRoomId(): number | null {
        return this.currentRoomId;
    }

    // 是否在房间中
    isJoined(): boolean {
        return this.isInRoom;
    }

    // 销毁实例
    destroy(): void {
        if (this.trtc) {
            this.trtc.destroy();
            this.trtc = null;
            this.isInRoom = false;
            this.currentRoomId = null;
            this.callbacks = {};
            console.log('TRTC destroyed');
        }
    }
}

// 单例
export const trtcService = new TRTCService();
export default trtcService;
