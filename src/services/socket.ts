// 智会 - Socket.io 客户端服务

import { io, Socket } from 'socket.io-client';

// 服务器地址
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 成员状态类型
export interface MemberState {
    userId: string;
    userName: string;
    role: 'host' | 'cohost' | 'member';
    isAudioOn: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isHandRaised: boolean;
}

// 房间状态类型
export interface RoomState {
    meetingId: string;
    hostId: string;
    isLocked: boolean;
    isAllMuted: boolean;
    allowSelfUnmute: boolean;
    recording: {
        isRecording: boolean;
        taskId?: string;
        startedBy?: string;
    };
    members: MemberState[];
}

// 事件回调类型
export interface SocketCallbacks {
    onRoomState?: (state: RoomState) => void;
    onMemberJoined?: (member: MemberState) => void;
    onMemberLeft?: (data: { userId: string }) => void;
    onMemberUpdated?: (data: Partial<MemberState> & { userId: string }) => void;
    onMemberKicked?: (data: { userId: string; forever: boolean; by: string }) => void;
    onMemberRoleChanged?: (data: { userId: string; role: string; by: string }) => void;
    onRoomLocked?: (data: { isLocked: boolean; by: string }) => void;
    onRoomMutedAll?: (data: { by: string; allowSelfUnmute: boolean }) => void;
    onRoomStoppedAllVideo?: (data: { by: string }) => void;
    onRoomHostChanged?: (data: { oldHostId: string; newHostId: string; by: string }) => void;
    onRoomEnded?: (data: { by: string }) => void;
    onRecordingStarted?: (data: { taskId: string; by: string }) => void;
    onRecordingStopped?: (data: { by: string }) => void;
    onYouMuted?: (data: { by: string }) => void;
    onYouVideoStopped?: (data: { by: string }) => void;
    onYouKicked?: (data: { by: string; forever: boolean }) => void;
    // 等候室回调
    onWaitingRoomJoined?: (data: { message: string }) => void;
    onWaitingRoomAdmitted?: (data: { message: string }) => void;
    onWaitingRoomRejected?: (data: { message: string }) => void;
    onWaitingRoomToggled?: (data: { enabled: boolean; by: string }) => void;
    onWaitingRoomRequest?: (data: { userId: string; userName: string; waitingCount: number }) => void;
    onWaitingRoomUpdated?: (data: { waitingList: Array<{ userId: string; userName: string; joinedAt: number }> }) => void;
    onError?: (data: { message: string }) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

class SocketService {
    private socket: Socket | null = null;
    private callbacks: SocketCallbacks = {};
    private currentMeetingId: string | null = null;

    /**
     * 连接到 Socket 服务器
     */
    connect(userId: string, userName?: string): void {
        if (this.socket?.connected) {
            console.log('✅ Socket 已连接');
            return;
        }

        console.log('🔌 连接 Socket 服务器:', SOCKET_URL);

        this.socket = io(SOCKET_URL, {
            auth: {
                userId,
                userName: userName || userId,
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.setupEventListeners();
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.currentMeetingId = null;
            console.log('🔌 Socket 已断开');
        }
    }

    /**
     * 设置事件回调
     */
    setCallbacks(callbacks: SocketCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        // 连接事件
        this.socket.on('connect', () => {
            console.log('✅ Socket 已连接:', this.socket?.id);
            this.callbacks.onConnect?.();
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Socket 已断开');
            this.callbacks.onDisconnect?.();
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket 连接错误:', error);
        });

        // 房间事件
        this.socket.on('room:state', (state: RoomState) => {
            console.log('📦 收到房间状态:', state);
            this.callbacks.onRoomState?.(state);
        });

        this.socket.on('room:locked', (data) => {
            console.log('🔒 房间锁定状态:', data);
            this.callbacks.onRoomLocked?.(data);
        });

        this.socket.on('room:muted_all', (data) => {
            console.log('🔇 全体静音:', data);
            this.callbacks.onRoomMutedAll?.(data);
        });

        this.socket.on('room:stopped_all_video', (data) => {
            console.log('📹 全体关闭视频:', data);
            this.callbacks.onRoomStoppedAllVideo?.(data);
        });

        this.socket.on('room:host_changed', (data) => {
            console.log('👑 主持人变更:', data);
            this.callbacks.onRoomHostChanged?.(data);
        });

        this.socket.on('room:ended', (data) => {
            console.log('🛑 会议结束:', data);
            this.callbacks.onRoomEnded?.(data);
        });

        // 成员事件
        this.socket.on('member:joined', (member: MemberState) => {
            console.log('📥 成员加入:', member);
            this.callbacks.onMemberJoined?.(member);
        });

        this.socket.on('member:left', (data) => {
            console.log('📤 成员离开:', data);
            this.callbacks.onMemberLeft?.(data);
        });

        this.socket.on('member:updated', (data) => {
            console.log('🔄 成员状态更新:', data);
            this.callbacks.onMemberUpdated?.(data);
        });

        this.socket.on('member:kicked', (data) => {
            console.log('🚫 成员被踢出:', data);
            this.callbacks.onMemberKicked?.(data);
        });

        this.socket.on('member:role_changed', (data) => {
            console.log('👔 成员角色变更:', data);
            this.callbacks.onMemberRoleChanged?.(data);
        });

        // 针对当前用户的事件
        this.socket.on('you:muted', (data) => {
            console.log('🔇 你被静音:', data);
            this.callbacks.onYouMuted?.(data);
        });

        this.socket.on('you:video_stopped', (data) => {
            console.log('📹 你的视频被关闭:', data);
            this.callbacks.onYouVideoStopped?.(data);
        });

        this.socket.on('you:kicked', (data) => {
            console.log('🚫 你被踢出:', data);
            this.callbacks.onYouKicked?.(data);
        });

        // 录制事件
        this.socket.on('recording:started', (data) => {
            console.log('🔴 录制开始:', data);
            this.callbacks.onRecordingStarted?.(data);
        });

        this.socket.on('recording:stopped', (data) => {
            console.log('⬜ 录制停止:', data);
            this.callbacks.onRecordingStopped?.(data);
        });

        // 等候室事件
        this.socket.on('waiting_room:joined', (data) => {
            console.log('⏳ 进入等候室:', data);
            this.callbacks.onWaitingRoomJoined?.(data);
        });

        this.socket.on('waiting_room:admitted', (data) => {
            console.log('✅ 被允许进入:', data);
            this.callbacks.onWaitingRoomAdmitted?.(data);
        });

        this.socket.on('waiting_room:rejected', (data) => {
            console.log('❌ 被拒绝进入:', data);
            this.callbacks.onWaitingRoomRejected?.(data);
        });

        this.socket.on('waiting_room:toggled', (data) => {
            console.log('🚪 等候室状态:', data);
            this.callbacks.onWaitingRoomToggled?.(data);
        });

        this.socket.on('waiting_room:request', (data) => {
            console.log('🔔 有人等候:', data);
            this.callbacks.onWaitingRoomRequest?.(data);
        });

        this.socket.on('waiting_room:updated', (data) => {
            console.log('📋 等候列表更新:', data);
            this.callbacks.onWaitingRoomUpdated?.(data);
        });

        // 错误
        this.socket.on('error', (data) => {
            console.error('❌ Socket 错误:', data);
            this.callbacks.onError?.(data);
        });
    }

    // ========== 房间操作 ==========

    /**
     * 加入房间
     */
    joinRoom(meetingId: string, userName?: string): void {
        if (!this.socket) {
            console.error('❌ Socket 未连接');
            return;
        }
        this.currentMeetingId = meetingId;
        this.socket.emit('room:join', { meetingId, userName });
        console.log('📥 请求加入房间:', meetingId);
    }

    /**
     * 离开房间
     */
    leaveRoom(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('room:leave', { meetingId: this.currentMeetingId });
        this.currentMeetingId = null;
        console.log('📤 离开房间');
    }

    /**
     * 请求房间状态（用于客户端重同步）
     */
    requestRoomState(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('room:state:request', { meetingId: this.currentMeetingId });
    }

    // ========== 状态广播 ==========

    /**
     * 广播音频状态
     */
    broadcastAudioState(isOn: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:audio', {
            meetingId: this.currentMeetingId,
            isOn,
        });
    }

    /**
     * 广播视频状态
     */
    broadcastVideoState(isOn: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:video', {
            meetingId: this.currentMeetingId,
            isOn,
        });
    }

    /**
     * 广播屏幕共享状态
     */
    broadcastScreenShareState(isSharing: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:screen', {
            meetingId: this.currentMeetingId,
            isSharing,
        });
    }

    /**
     * 广播举手状态
     */
    broadcastHandRaised(isRaised: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:hand', {
            meetingId: this.currentMeetingId,
            isRaised,
        });
    }

    /**
     * 成员状态同步（心跳）
     */
    reportMemberState(state: { isAudioOn?: boolean; isVideoOn?: boolean; isScreenSharing?: boolean; isHandRaised?: boolean }): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:state', {
            meetingId: this.currentMeetingId,
            state,
        });
    }

    /**
     * 更新显示名称
     */
    updateUserName(userName: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('member:rename', {
            meetingId: this.currentMeetingId,
            userName,
        });
    }

    // ========== 主持人操作 ==========

    /**
     * 静音成员
     */
    muteMember(targetId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:mute', {
            meetingId: this.currentMeetingId,
            targetId,
        });
    }

    /**
     * 关闭成员视频
     */
    stopVideoMember(targetId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:stop_video', {
            meetingId: this.currentMeetingId,
            targetId,
        });
    }

    /**
     * 踢出成员
     */
    kickMember(targetId: string, forever = false): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:kick', {
            meetingId: this.currentMeetingId,
            targetId,
            forever,
        });
    }

    /**
     * 全体静音
     */
    muteAll(allowSelfUnmute = true): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:mute_all', {
            meetingId: this.currentMeetingId,
            allowSelfUnmute,
        });
    }

    /**
     * 全体关闭视频
     */
    stopVideoAll(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:stop_all_video', {
            meetingId: this.currentMeetingId,
        });
    }

    /**
     * 锁定会议
     */
    lockMeeting(isLocked: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:lock', {
            meetingId: this.currentMeetingId,
            isLocked,
        });
    }

    /**
     * 指定联席主持人
     */
    assignCoHost(targetId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:assign_cohost', {
            meetingId: this.currentMeetingId,
            targetId,
        });
    }

    /**
     * 转让主持人
     */
    transferHost(newHostId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:transfer', {
            meetingId: this.currentMeetingId,
            newHostId,
        });
    }

    /**
     * 结束会议
     */
    endMeeting(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('host:end', {
            meetingId: this.currentMeetingId,
        });
    }

    // ========== 录制操作 ==========

    /**
     * 开始录制
     */
    startRecording(taskId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('recording:start', {
            meetingId: this.currentMeetingId,
            taskId,
        });
    }

    /**
     * 停止录制
     */
    stopRecording(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('recording:stop', {
            meetingId: this.currentMeetingId,
        });
    }

    // ========== 等候室操作 ==========

    /**
     * 开启/关闭等候室
     */
    toggleWaitingRoom(enabled: boolean): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('waiting_room:toggle', {
            meetingId: this.currentMeetingId,
            enabled,
        });
    }

    /**
     * 允许参与者进入
     */
    admitFromWaitingRoom(targetId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('waiting_room:admit', {
            meetingId: this.currentMeetingId,
            targetId,
        });
    }

    /**
     * 拒绝参与者进入
     */
    rejectFromWaitingRoom(targetId: string): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('waiting_room:reject', {
            meetingId: this.currentMeetingId,
            targetId,
        });
    }

    /**
     * 允许所有等候者进入
     */
    admitAllFromWaitingRoom(): void {
        if (!this.socket || !this.currentMeetingId) return;
        this.socket.emit('waiting_room:admit_all', {
            meetingId: this.currentMeetingId,
        });
    }

    // ========== 工具方法 ==========

    /**
     * 是否已连接
     */
    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * 当前会议ID
     */
    get meetingId(): string | null {
        return this.currentMeetingId;
    }
}

// 导出单例
export const socketService = new SocketService();

export default socketService;
