// 智会后端 - Socket.io 事件处理器

import { Server, Socket } from 'socket.io';
import { getDatabase } from '../db';
import { canPerformAction, isAdminRole, type MeetingRole } from './permissions';

// 类型定义
interface MemberState {
    userId: string;
    userName: string;
    role: MeetingRole;
    isAudioOn: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isHandRaised: boolean;
}

interface RoomState {
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

// 活跃会议房间状态缓存
const roomStates = new Map<string, RoomState>();
// 用户ID到Socket映射
const userSockets = new Map<string, Socket>();

/**
 * 获取或创建房间状态
 */
function getOrCreateRoomState(meetingId: string): RoomState {
    if (!roomStates.has(meetingId)) {
        const db = getDatabase();

        // 从数据库加载会议信息
        const meeting = db.prepare(`
            SELECT id, host_id, status FROM meetings WHERE id = ?
        `).get(meetingId) as { id: string; host_id: string; status: string } | undefined;

        // 从数据库加载成员
        const members = db.prepare(`
            SELECT user_id, user_name, role, is_muted, is_camera_off
            FROM meeting_members 
            WHERE meeting_id = ? AND left_at IS NULL
        `).all(meetingId) as Array<{
            user_id: string;
            user_name: string;
            role: string;
            is_muted: number;
            is_camera_off: number;
        }>;

        roomStates.set(meetingId, {
            meetingId,
            hostId: meeting?.host_id || '',
            isLocked: false,
            isAllMuted: false,
            allowSelfUnmute: true,
            recording: { isRecording: false },
            members: members.map(m => ({
                userId: m.user_id,
                userName: m.user_name,
                role: m.role as MeetingRole,
                isAudioOn: !m.is_muted,
                isVideoOn: !m.is_camera_off,
                isScreenSharing: false,
                isHandRaised: false,
            })),
        });
    }
    return roomStates.get(meetingId)!;
}

/**
 * 获取用户在房间中的角色
 */
function getUserRole(meetingId: string, userId: string): MeetingRole {
    const state = roomStates.get(meetingId);
    if (!state) return 'member';

    if (state.hostId === userId) return 'host';

    const member = state.members.find(m => m.userId === userId);
    return member?.role || 'member';
}

/**
 * 更新数据库中的成员状态
 */
function updateMemberInDB(meetingId: string, userId: string, updates: Record<string, unknown>): void {
    const db = getDatabase();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), meetingId, userId];

    try {
        db.prepare(`
            UPDATE meeting_members SET ${setClauses}
            WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL
        `).run(...values);
    } catch (error) {
        console.error('Failed to update member in DB:', error);
    }
}

/**
 * 注册所有Socket事件处理器
 */
export function registerHandlers(io: Server, socket: Socket): void {
    const userId = socket.data.userId as string;
    const userName = socket.data.userName as string || userId;

    console.log(`🔌 用户连接: ${userId}`);
    userSockets.set(userId, socket);

    // ========== 房间操作 ==========

    /**
     * 加入房间
     */
    socket.on('room:join', async (data: { meetingId: string; userName?: string }) => {
        const { meetingId, userName: joinName } = data;
        const displayName = joinName || userName;

        console.log(`📥 ${displayName} 加入房间: ${meetingId}`);

        // 加入Socket.io房间
        socket.join(meetingId);
        socket.data.meetingId = meetingId;

        // 获取/创建房间状态
        const state = getOrCreateRoomState(meetingId);

        // 添加成员
        const existingMember = state.members.find(m => m.userId === userId);
        if (!existingMember) {
            const newMember: MemberState = {
                userId,
                userName: displayName,
                role: state.hostId === userId ? 'host' : 'member',
                isAudioOn: false,
                isVideoOn: false,
                isScreenSharing: false,
                isHandRaised: false,
            };
            state.members.push(newMember);

            // 广播新成员加入
            socket.to(meetingId).emit('member:joined', newMember);
        }

        // 发送完整房间状态给新加入的用户
        socket.emit('room:state', state);
    });

    /**
     * 离开房间
     */
    socket.on('room:leave', (data: { meetingId: string }) => {
        const { meetingId } = data;
        handleLeaveRoom(socket, meetingId, userId);
    });

    // ========== 成员状态 ==========

    /**
     * 音频状态变更
     */
    socket.on('member:audio', (data: { meetingId: string; isOn: boolean }) => {
        const { meetingId, isOn } = data;
        const state = roomStates.get(meetingId);
        if (!state) return;

        // 检查全体静音
        if (isOn && state.isAllMuted && !state.allowSelfUnmute) {
            const role = getUserRole(meetingId, userId);
            if (!isAdminRole(role)) {
                socket.emit('error', { message: '主持人已开启全体静音' });
                return;
            }
        }

        // 更新状态
        const member = state.members.find(m => m.userId === userId);
        if (member) {
            member.isAudioOn = isOn;
        }

        // 更新数据库
        updateMemberInDB(meetingId, userId, { is_muted: isOn ? 0 : 1 });

        // 广播给所有人
        io.to(meetingId).emit('member:updated', {
            userId,
            isAudioOn: isOn,
        });

        console.log(`🎤 ${userId} 音频: ${isOn ? '开启' : '关闭'}`);
    });

    /**
     * 视频状态变更
     */
    socket.on('member:video', (data: { meetingId: string; isOn: boolean }) => {
        const { meetingId, isOn } = data;
        const state = roomStates.get(meetingId);
        if (!state) return;

        const member = state.members.find(m => m.userId === userId);
        if (member) {
            member.isVideoOn = isOn;
        }

        updateMemberInDB(meetingId, userId, { is_camera_off: isOn ? 0 : 1 });

        io.to(meetingId).emit('member:updated', {
            userId,
            isVideoOn: isOn,
        });

        console.log(`📹 ${userId} 视频: ${isOn ? '开启' : '关闭'}`);
    });

    /**
     * 屏幕共享状态变更
     */
    socket.on('member:screen', (data: { meetingId: string; isSharing: boolean }) => {
        const { meetingId, isSharing } = data;
        const state = roomStates.get(meetingId);
        if (!state) return;

        const member = state.members.find(m => m.userId === userId);
        if (member) {
            member.isScreenSharing = isSharing;
        }

        io.to(meetingId).emit('member:updated', {
            userId,
            isScreenSharing: isSharing,
        });

        console.log(`🖥️ ${userId} 屏幕共享: ${isSharing ? '开始' : '停止'}`);
    });

    /**
     * 举手
     */
    socket.on('member:hand', (data: { meetingId: string; isRaised: boolean }) => {
        const { meetingId, isRaised } = data;
        const state = roomStates.get(meetingId);
        if (!state) return;

        const member = state.members.find(m => m.userId === userId);
        if (member) {
            member.isHandRaised = isRaised;
        }

        io.to(meetingId).emit('member:updated', {
            userId,
            isHandRaised: isRaised,
        });

        console.log(`✋ ${userId} ${isRaised ? '举手' : '放下手'}`);
    });

    // ========== 主持人控制 ==========

    /**
     * 静音他人
     */
    socket.on('host:mute', (data: { meetingId: string; targetId: string }) => {
        const { meetingId, targetId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'mute_member')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        const target = state.members.find(m => m.userId === targetId);
        if (target) {
            target.isAudioOn = false;
        }

        updateMemberInDB(meetingId, targetId, { is_muted: 1 });

        io.to(meetingId).emit('member:updated', {
            userId: targetId,
            isAudioOn: false,
            mutedBy: userId,
        });

        // 通知被静音的用户
        const targetSocket = userSockets.get(targetId);
        if (targetSocket) {
            targetSocket.emit('you:muted', { by: userId });
        }

        console.log(`🔇 ${userId} 静音了 ${targetId}`);
    });

    /**
     * 关闭他人视频
     */
    socket.on('host:stop_video', (data: { meetingId: string; targetId: string }) => {
        const { meetingId, targetId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'stop_member_video')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        const target = state.members.find(m => m.userId === targetId);
        if (target) {
            target.isVideoOn = false;
        }

        updateMemberInDB(meetingId, targetId, { is_camera_off: 1 });

        io.to(meetingId).emit('member:updated', {
            userId: targetId,
            isVideoOn: false,
            stoppedBy: userId,
        });

        // 通知被关闭视频的用户
        const targetSocket = userSockets.get(targetId);
        if (targetSocket) {
            targetSocket.emit('you:video_stopped', { by: userId });
        }

        console.log(`📹 ${userId} 关闭了 ${targetId} 的视频`);
    });

    /**
     * 踢出成员
     */
    socket.on('host:kick', (data: { meetingId: string; targetId: string; forever?: boolean }) => {
        const { meetingId, targetId, forever = false } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, forever ? 'kick_member_forever' : 'kick_member')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        // 移除成员
        state.members = state.members.filter(m => m.userId !== targetId);

        // 广播
        io.to(meetingId).emit('member:kicked', {
            userId: targetId,
            forever,
            by: userId,
        });

        // 强制目标用户离开
        const targetSocket = userSockets.get(targetId);
        if (targetSocket) {
            targetSocket.emit('you:kicked', { by: userId, forever });
            targetSocket.leave(meetingId);
        }

        console.log(`🚫 ${userId} 踢出了 ${targetId}${forever ? ' (永久)' : ''}`);
    });

    /**
     * 全体静音
     */
    socket.on('host:mute_all', (data: { meetingId: string; allowSelfUnmute?: boolean }) => {
        const { meetingId, allowSelfUnmute = true } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'mute_all')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        state.isAllMuted = true;
        state.allowSelfUnmute = allowSelfUnmute;

        // 静音所有非管理员
        state.members.forEach(m => {
            if (!isAdminRole(m.role)) {
                m.isAudioOn = false;
            }
        });

        io.to(meetingId).emit('room:muted_all', {
            by: userId,
            allowSelfUnmute,
        });

        console.log(`🔇 ${userId} 开启全体静音`);
    });

    /**
     * 锁定会议
     */
    socket.on('host:lock', (data: { meetingId: string; isLocked: boolean }) => {
        const { meetingId, isLocked } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'lock_meeting')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        state.isLocked = isLocked;

        io.to(meetingId).emit('room:locked', { isLocked, by: userId });

        console.log(`🔒 ${userId} ${isLocked ? '锁定' : '解锁'}会议`);
    });

    /**
     * 指定联席主持人
     */
    socket.on('host:assign_cohost', (data: { meetingId: string; targetId: string }) => {
        const { meetingId, targetId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'assign_co_host')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        const target = state.members.find(m => m.userId === targetId);
        if (target) {
            target.role = 'cohost';
        }

        // 更新数据库
        const db = getDatabase();
        db.prepare(`
            UPDATE meeting_members SET role = 'cohost'
            WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL
        `).run(meetingId, targetId);

        io.to(meetingId).emit('member:role_changed', {
            userId: targetId,
            role: 'cohost',
            by: userId,
        });

        console.log(`👑 ${userId} 将 ${targetId} 设为联席主持人`);
    });

    /**
     * 转让主持人
     */
    socket.on('host:transfer', (data: { meetingId: string; newHostId: string }) => {
        const { meetingId, newHostId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'transfer_host')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        const oldHostId = state.hostId;
        state.hostId = newHostId;

        // 更新角色
        state.members.forEach(m => {
            if (m.userId === oldHostId) m.role = 'member';
            if (m.userId === newHostId) m.role = 'host';
        });

        // 更新数据库
        const db = getDatabase();
        db.prepare(`UPDATE meetings SET host_id = ? WHERE id = ?`).run(newHostId, meetingId);
        db.prepare(`
            UPDATE meeting_members SET role = 'member'
            WHERE meeting_id = ? AND user_id = ?
        `).run(meetingId, oldHostId);
        db.prepare(`
            UPDATE meeting_members SET role = 'host'
            WHERE meeting_id = ? AND user_id = ?
        `).run(meetingId, newHostId);

        io.to(meetingId).emit('room:host_changed', {
            oldHostId,
            newHostId,
            by: userId,
        });

        console.log(`👑 ${userId} 将主持人转让给 ${newHostId}`);
    });

    /**
     * 结束会议
     */
    socket.on('host:end', (data: { meetingId: string }) => {
        const { meetingId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'end_meeting')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        // 更新数据库
        const db = getDatabase();
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
            UPDATE meetings SET status = 'ended', ended_at = ? WHERE id = ?
        `).run(now, meetingId);

        // 广播会议结束
        io.to(meetingId).emit('room:ended', { by: userId });

        // 清理状态
        roomStates.delete(meetingId);

        console.log(`🛑 ${userId} 结束了会议 ${meetingId}`);
    });

    // ========== 录制控制 ==========

    socket.on('recording:start', (data: { meetingId: string; taskId: string }) => {
        const { meetingId, taskId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'start_recording')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        state.recording = {
            isRecording: true,
            taskId,
            startedBy: userId,
        };

        io.to(meetingId).emit('recording:started', {
            taskId,
            by: userId,
        });

        console.log(`🔴 ${userId} 开始录制`);
    });

    socket.on('recording:stop', (data: { meetingId: string }) => {
        const { meetingId } = data;
        const role = getUserRole(meetingId, userId);

        if (!canPerformAction(role, 'stop_recording')) {
            socket.emit('error', { message: '无权限执行此操作' });
            return;
        }

        const state = roomStates.get(meetingId);
        if (!state) return;

        state.recording = { isRecording: false };

        io.to(meetingId).emit('recording:stopped', { by: userId });

        console.log(`⬜ ${userId} 停止录制`);
    });

    // ========== 断开连接 ==========

    socket.on('disconnect', () => {
        console.log(`🔌 用户断开: ${userId}`);
        userSockets.delete(userId);

        const meetingId = socket.data.meetingId as string;
        if (meetingId) {
            handleLeaveRoom(socket, meetingId, userId);
        }
    });
}

/**
 * 处理离开房间
 */
function handleLeaveRoom(socket: Socket, meetingId: string, userId: string): void {
    const state = roomStates.get(meetingId);
    if (!state) return;

    // 移除成员
    state.members = state.members.filter(m => m.userId !== userId);

    // 更新数据库
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
        UPDATE meeting_members SET left_at = ?
        WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL
    `).run(now, meetingId, userId);

    // 离开 Socket.io 房间
    socket.leave(meetingId);

    // 广播
    socket.to(meetingId).emit('member:left', { userId });

    console.log(`📤 ${userId} 离开房间: ${meetingId}`);

    // 如果房间空了，清理状态
    if (state.members.length === 0) {
        roomStates.delete(meetingId);
    }
}

export { roomStates, userSockets };
