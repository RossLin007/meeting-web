// 智会后端 - 会议存储接口和实现

import crypto from 'crypto';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

// ========== RoomID 生成 ==========

/**
 * 生成唯一的 RoomID
 * 
 * 范围：100000 ~ 4294967295 (符合 TRTC 规范)
 * 特性：
 * - 使用加密安全的随机数生成
 * - 数据库唯一性校验
 * - 自动重试机制
 * 
 * @param maxRetries 最大重试次数，默认 10 次
 * @returns 唯一的 RoomID 字符串
 */
const generateUniqueRoomId = (maxRetries = 10): string => {
    // TRTC 支持 1 ~ 4294967295，使用较大起始值确保 ID 长度
    const MIN_ROOM_ID = 100000;
    const MAX_ROOM_ID = 4294967295;
    const range = MAX_ROOM_ID - MIN_ROOM_ID;

    for (let i = 0; i < maxRetries; i++) {
        // 使用加密安全的随机数
        const randomBuffer = crypto.randomBytes(4);
        const randomValue = randomBuffer.readUInt32BE(0);
        const roomId = (MIN_ROOM_ID + (randomValue % range)).toString();

        // 检查数据库中是否已存在
        const exists = db.prepare('SELECT 1 FROM meetings WHERE id = ?').get(roomId);
        if (!exists) {
            return roomId;
        }
        console.warn(`⚠️ RoomID ${roomId} 已存在，重试 ${i + 1}/${maxRetries}`);
    }

    throw new Error('无法生成唯一的 RoomID，请稍后重试');
};

// 类型定义
export interface Meeting {
    id: string;
    title: string;
    password?: string;
    createdBy: string;
    hostId: string;
    imGroupId?: string;  // IM 群组 ID
    status: 'waiting' | 'ongoing' | 'ended';
    startedAt?: number;
    endedAt?: number;
    createdAt: number;
    updatedAt: number;
    // 预约会议字段
    scheduledAt?: number;      // 预约开始时间 (Unix timestamp)
    duration?: number;         // 预定时长(分钟)
    repeatFrequency?: string;  // 重复频率: none, daily, weekdays, weekly, monthly
    repeatEndType?: string;    // 结束类型: never, count, date
    repeatEndCount?: number;   // 重复次数
    repeatEndDate?: number;    // 结束日期 (Unix timestamp)
}

export interface MeetingSettings {
    meetingId: string;
    muteOnJoin: boolean;
    allowScreenShare: boolean;
    allowChat: boolean;
    waitingRoom: boolean;
    maxParticipants: number;
}

export interface MeetingMember {
    id: number;
    meetingId: string;
    userId: string;
    userName: string;
    role: 'host' | 'cohost' | 'member';
    isMuted: boolean;
    isCameraOff: boolean;
    joinedAt: number;
    leftAt?: number;
}

export interface Recording {
    id: string;
    meetingId: string;
    startedBy: string;
    startedAt: number;
    endedAt?: number;
    duration?: number;
    fileUrl?: string;
    fileSize?: number;
    status: 'recording' | 'completed' | 'failed';
    createdAt: number;
}

export interface ChatMessage {
    id: string;
    meetingId: string;
    senderId: string;
    senderName: string;
    content: string;
    type: 'text' | 'image' | 'file';
    fileUrl?: string;
    createdAt: number;
}

export interface MeetingEvent {
    id: number;
    meetingId: string;
    userId?: string;
    eventType: string;
    targetUserId?: string;
    data?: string;
    createdAt: number;
}

// 会议房间状态（用于前端同步）
export interface RoomState {
    meeting: Meeting;
    settings: MeetingSettings;
    members: MeetingMember[];
    recording?: Recording;
}

// ========== 会议管理 ==========

/**
 * 创建会议
 */
export const createMeeting = (params: {
    title: string;
    password?: string;
    createdBy: string;
    imGroupId?: string;  // 可选的 IM 群组 ID
}): Meeting => {
    const id = generateUniqueRoomId();
    const now = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
        INSERT INTO meetings (id, title, password, created_by, host_id, im_group_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?)
    `);
    stmt.run(id, params.title, params.password || null, params.createdBy, params.createdBy, params.imGroupId || null, now, now);

    // 创建默认设置
    const settingsStmt = db.prepare(`
        INSERT INTO meeting_settings (meeting_id)
        VALUES (?)
    `);
    settingsStmt.run(id);

    // 记录事件
    logMeetingEvent(id, params.createdBy, 'meeting.created');

    return getMeeting(id)!;
};

/**
 * 获取会议信息
 */
export const getMeeting = (meetingId: string): Meeting | null => {
    const stmt = db.prepare(`
        SELECT id, title, password, created_by as createdBy, host_id as hostId,
               im_group_id as imGroupId,
               status, started_at as startedAt, ended_at as endedAt,
               created_at as createdAt, updated_at as updatedAt
        FROM meetings WHERE id = ?
    `);
    return stmt.get(meetingId) as Meeting | null;
};

/**
 * 更新会议状态
 */
export const updateMeetingStatus = (meetingId: string, status: Meeting['status']): void => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        UPDATE meetings
        SET status = ?,
            started_at = CASE WHEN ? = 'ongoing' AND started_at IS NULL THEN ? ELSE started_at END,
            ended_at = CASE WHEN ? = 'ended' THEN ? ELSE ended_at END,
            updated_at = ?
        WHERE id = ?
    `);
    stmt.run(status, status, now, status, now, now, meetingId);
};

/**
 * 注册 IM 群组 ID（幂等操作）
 *
 * 说明：
 * - 只有当 im_group_id 为 NULL 时才更新，防止覆盖
 * - 返回是否成功更新（如果返回 false，说明已被其他人注册）
 */
export const registerImGroupId = (meetingId: string, imGroupId: string): boolean => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        UPDATE meetings
        SET im_group_id = ?,
            updated_at = ?
        WHERE id = ? AND im_group_id IS NULL
    `);

    const result = stmt.run(imGroupId, now, meetingId);
    return result.changes > 0;
};

/**
 * 转移主持人
 */
export const transferHost = (meetingId: string, newHostId: string, operatorId: string): void => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        UPDATE meetings SET host_id = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newHostId, now, meetingId);

    // 更新成员角色
    db.prepare(`UPDATE meeting_members SET role = 'member' WHERE meeting_id = ? AND role = 'host' AND left_at IS NULL`)
        .run(meetingId);
    db.prepare(`UPDATE meeting_members SET role = 'host' WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL`)
        .run(meetingId, newHostId);

    logMeetingEvent(meetingId, operatorId, 'host.changed', newHostId);
};

// ========== 成员管理 ==========

/**
 * 加入会议
 */
export const joinMeeting = (params: {
    meetingId: string;
    userId: string;
    userName: string;
}): MeetingMember => {
    const meeting = getMeeting(params.meetingId);
    if (!meeting) {
        throw new Error('Meeting not found');
    }

    const now = Math.floor(Date.now() / 1000);
    const isHost = meeting.createdBy === params.userId;
    const role = isHost ? 'host' : 'member';

    const stmt = db.prepare(`
        INSERT INTO meeting_members (meeting_id, user_id, user_name, role, joined_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(params.meetingId, params.userId, params.userName, role, now);

    // 如果是第一个成员加入，更新会议状态为进行中
    if (meeting.status === 'waiting') {
        updateMeetingStatus(params.meetingId, 'ongoing');
        logMeetingEvent(params.meetingId, params.userId, 'meeting.started');
    }

    logMeetingEvent(params.meetingId, params.userId, 'member.joined');

    return {
        id: result.lastInsertRowid as number,
        meetingId: params.meetingId,
        userId: params.userId,
        userName: params.userName,
        role,
        isMuted: false,
        isCameraOff: false,
        joinedAt: now,
    };
};

/**
 * 离开会议
 */
export const leaveMeeting = async (meetingId: string, userId: string): Promise<void> => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        UPDATE meeting_members 
        SET left_at = ? 
        WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL
    `);
    stmt.run(now, meetingId, userId);

    logMeetingEvent(meetingId, userId, 'member.left');

    // 检查是否还有成员在线
    const onlineCount = getOnlineMembers(meetingId).length;
    if (onlineCount === 0) {
        // 如果没有人在线，结束会议
        updateMeetingStatus(meetingId, 'ended');
        logMeetingEvent(meetingId, userId, 'meeting.ended');

        // 自动添加转录任务（直接创建数据库记录，Worker 服务会轮询处理）
        try {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO transcription_tasks (meeting_id, status, created_at)
                VALUES (?, 'pending', strftime('%s', 'now'))
            `);
            stmt.run(meetingId);
            console.log(`📝 已为会议 ${meetingId} 添加转录任务`);
        } catch (error) {
            console.error(`⚠️ 添加转录任务失败:`, error);
        }
    }
};

/**
 * 获取在线成员
 */
export const getOnlineMembers = (meetingId: string): MeetingMember[] => {
    const stmt = db.prepare(`
        SELECT id, meeting_id as meetingId, user_id as userId, user_name as userName,
               role, is_muted as isMuted, is_camera_off as isCameraOff,
               joined_at as joinedAt, left_at as leftAt
        FROM meeting_members 
        WHERE meeting_id = ? AND left_at IS NULL
        ORDER BY joined_at ASC
    `);
    return stmt.all(meetingId) as MeetingMember[];
};

/**
 * 更新成员状态（静音/摄像头）
 */
export const updateMemberStatus = (
    meetingId: string,
    userId: string,
    updates: { isMuted?: boolean; isCameraOff?: boolean },
    operatorId: string
): void => {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.isMuted !== undefined) {
        setClauses.push('is_muted = ?');
        values.push(updates.isMuted ? 1 : 0);
    }
    if (updates.isCameraOff !== undefined) {
        setClauses.push('is_camera_off = ?');
        values.push(updates.isCameraOff ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    values.push(meetingId, userId);
    const stmt = db.prepare(`
        UPDATE meeting_members 
        SET ${setClauses.join(', ')}
        WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL
    `);
    stmt.run(...values);

    if (updates.isMuted !== undefined) {
        logMeetingEvent(meetingId, operatorId, updates.isMuted ? 'member.muted' : 'member.unmuted', userId);
    }
    if (updates.isCameraOff !== undefined) {
        logMeetingEvent(meetingId, operatorId, updates.isCameraOff ? 'member.camera_off' : 'member.camera_on', userId);
    }
};

// ========== 录制管理 ==========

/**
 * 开始录制
 */
export const startRecording = (meetingId: string, userId: string, taskId: string): Recording => {
    const now = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
        INSERT INTO recordings (id, meeting_id, started_by, started_at, status)
        VALUES (?, ?, ?, ?, 'recording')
    `);
    stmt.run(taskId, meetingId, userId, now);

    logMeetingEvent(meetingId, userId, 'recording.started');

    return {
        id: taskId,
        meetingId,
        startedBy: userId,
        startedAt: now,
        status: 'recording',
        createdAt: now,
    };
};

/**
 * 停止录制
 */
export const stopRecording = (taskId: string, userId: string, fileUrl?: string, fileSize?: number): void => {
    const now = Math.floor(Date.now() / 1000);

    // 获取录制信息计算时长
    const recordingStmt = db.prepare(`SELECT started_at, meeting_id FROM recordings WHERE id = ?`);
    const recording = recordingStmt.get(taskId) as { started_at: number; meeting_id: string } | undefined;

    if (!recording) return;

    const duration = now - recording.started_at;

    const stmt = db.prepare(`
        UPDATE recordings 
        SET ended_at = ?, duration = ?, file_url = ?, file_size = ?, status = 'completed'
        WHERE id = ?
    `);
    stmt.run(now, duration, fileUrl || null, fileSize || null, taskId);

    logMeetingEvent(recording.meeting_id, userId, 'recording.stopped');
};

/**
 * 获取当前录制
 */
export const getCurrentRecording = (meetingId: string): Recording | null => {
    const stmt = db.prepare(`
        SELECT id, meeting_id as meetingId, started_by as startedBy,
               started_at as startedAt, ended_at as endedAt, duration,
               file_url as fileUrl, file_size as fileSize, status,
               created_at as createdAt
        FROM recordings 
        WHERE meeting_id = ? AND status = 'recording'
        LIMIT 1
    `);
    return stmt.get(meetingId) as Recording | null;
};

// ========== 聊天消息 ==========

/**
 * 保存聊天消息
 */
export const saveChatMessage = (params: {
    meetingId: string;
    senderId: string;
    senderName: string;
    content: string;
    type?: 'text' | 'image' | 'file';
    fileUrl?: string;
}): ChatMessage => {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const type = params.type || 'text';

    const stmt = db.prepare(`
        INSERT INTO chat_messages (id, meeting_id, sender_id, sender_name, content, type, file_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, params.meetingId, params.senderId, params.senderName, params.content, type, params.fileUrl || null, now);

    return {
        id,
        meetingId: params.meetingId,
        senderId: params.senderId,
        senderName: params.senderName,
        content: params.content,
        type,
        fileUrl: params.fileUrl,
        createdAt: now,
    };
};

/**
 * 获取聊天历史
 */
export const getChatMessages = (meetingId: string, limit = 100): ChatMessage[] => {
    const stmt = db.prepare(`
        SELECT id, meeting_id as meetingId, sender_id as senderId, sender_name as senderName,
               content, type, file_url as fileUrl, created_at as createdAt
        FROM chat_messages 
        WHERE meeting_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `);
    return (stmt.all(meetingId, limit) as ChatMessage[]).reverse();
};

// ========== 事件日志 ==========

/**
 * 记录会议事件
 */
export const logMeetingEvent = (
    meetingId: string,
    userId: string | null,
    eventType: string,
    targetUserId?: string,
    data?: object
): void => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        INSERT INTO meeting_events (meeting_id, user_id, event_type, target_user_id, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(meetingId, userId, eventType, targetUserId || null, data ? JSON.stringify(data) : null, now);
};

// ========== 房间状态（聚合） ==========

/**
 * 获取完整的房间状态
 */
export const getRoomState = (meetingId: string): RoomState | null => {
    const meeting = getMeeting(meetingId);
    if (!meeting) return null;

    const settingsStmt = db.prepare(`
        SELECT meeting_id as meetingId, mute_on_join as muteOnJoin, 
               allow_screen_share as allowScreenShare, allow_chat as allowChat,
               waiting_room as waitingRoom, max_participants as maxParticipants
        FROM meeting_settings WHERE meeting_id = ?
    `);
    const settings = settingsStmt.get(meetingId) as MeetingSettings;

    const members = getOnlineMembers(meetingId);
    const recording = getCurrentRecording(meetingId) || undefined;

    return { meeting, settings, members, recording };
};

// ========== 用户偏好设置 ==========

export interface UserPreferences {
    userId: string;
    theme: string;
    language: string;
    defaultMicOn: boolean;
    defaultCameraOn: boolean;
    defaultMicDevice?: string;
    defaultCameraDevice?: string;
    updatedAt: number;
}

/**
 * 获取用户偏好设置
 */
export const getUserPreferences = (userId: string): UserPreferences | null => {
    const stmt = db.prepare(`
        SELECT user_id as userId, theme, language, 
               default_mic_on as defaultMicOn, default_camera_on as defaultCameraOn,
               default_mic_device as defaultMicDevice, default_camera_device as defaultCameraDevice,
               updated_at as updatedAt
        FROM user_preferences WHERE user_id = ?
    `);
    return stmt.get(userId) as UserPreferences | null;
};

/**
 * 更新用户偏好设置（不存在则创建）
 */
export const updateUserPreferences = (
    userId: string,
    preferences: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>
): UserPreferences => {
    const now = Math.floor(Date.now() / 1000);

    // 检查是否存在
    const existing = getUserPreferences(userId);

    if (!existing) {
        // 创建新记录
        const stmt = db.prepare(`
            INSERT INTO user_preferences (
                user_id, theme, language, default_mic_on, default_camera_on,
                default_mic_device, default_camera_device, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            userId,
            preferences.theme ?? 'blue',
            preferences.language ?? 'zh-CN',
            preferences.defaultMicOn !== false ? 1 : 0,
            preferences.defaultCameraOn !== false ? 1 : 0,
            preferences.defaultMicDevice ?? null,
            preferences.defaultCameraDevice ?? null,
            now
        );
    } else {
        // 更新现有记录
        const updates: string[] = [];
        const values: unknown[] = [];

        if (preferences.theme !== undefined) {
            updates.push('theme = ?');
            values.push(preferences.theme);
        }
        if (preferences.language !== undefined) {
            updates.push('language = ?');
            values.push(preferences.language);
        }
        if (preferences.defaultMicOn !== undefined) {
            updates.push('default_mic_on = ?');
            values.push(preferences.defaultMicOn ? 1 : 0);
        }
        if (preferences.defaultCameraOn !== undefined) {
            updates.push('default_camera_on = ?');
            values.push(preferences.defaultCameraOn ? 1 : 0);
        }
        if (preferences.defaultMicDevice !== undefined) {
            updates.push('default_mic_device = ?');
            values.push(preferences.defaultMicDevice);
        }
        if (preferences.defaultCameraDevice !== undefined) {
            updates.push('default_camera_device = ?');
            values.push(preferences.defaultCameraDevice);
        }

        if (updates.length > 0) {
            updates.push('updated_at = ?');
            values.push(now);
            values.push(userId);

            const stmt = db.prepare(`
                UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?
            `);
            stmt.run(...values);
        }
    }

    return getUserPreferences(userId)!;
};

// ========== 预约会议 ==========

export interface MeetingParticipant {
    id: number;
    meetingId: string;
    userId: string;
    userName: string;
    email?: string;
    status: 'invited' | 'accepted' | 'declined';
    notifiedAt?: number;
    createdAt: number;
}

export interface ScheduledMeetingInput {
    title: string;
    password?: string;
    scheduledAt: number;    // Unix timestamp
    duration: number;       // 分钟
    repeatFrequency?: string;
    repeatEndType?: string;
    repeatEndCount?: number;
    repeatEndDate?: number;
    createdBy: string;
    participants?: Array<{
        userId: string;
        userName: string;
        email?: string;
    }>;
}

/**
 * 创建预约会议
 */
export const createScheduledMeeting = (params: ScheduledMeetingInput): Meeting => {
    const id = generateUniqueRoomId();
    const now = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
        INSERT INTO meetings (
            id, title, password, created_by, host_id, status,
            scheduled_at, duration, repeat_frequency, repeat_end_type, 
            repeat_end_count, repeat_end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        id,
        params.title,
        params.password || null,
        params.createdBy,
        params.createdBy,
        params.scheduledAt,
        params.duration,
        params.repeatFrequency || 'none',
        params.repeatEndType || 'never',
        params.repeatEndCount || null,
        params.repeatEndDate || null,
        now,
        now
    );

    // 创建默认设置
    db.prepare(`INSERT INTO meeting_settings (meeting_id) VALUES (?)`).run(id);

    // 添加参与人
    if (params.participants && params.participants.length > 0) {
        const participantStmt = db.prepare(`
            INSERT INTO meeting_participants (meeting_id, user_id, user_name, email, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const p of params.participants) {
            participantStmt.run(id, p.userId, p.userName, p.email || null, now);
        }
    }

    logMeetingEvent(id, params.createdBy, 'meeting.scheduled');

    return getScheduledMeeting(id)!;
};

/**
 * 获取预约会议
 */
export const getScheduledMeeting = (meetingId: string): Meeting | null => {
    const stmt = db.prepare(`
        SELECT id, title, password, created_by as createdBy, host_id as hostId,
               im_group_id as imGroupId, status, 
               started_at as startedAt, ended_at as endedAt,
               scheduled_at as scheduledAt, duration,
               repeat_frequency as repeatFrequency, repeat_end_type as repeatEndType,
               repeat_end_count as repeatEndCount, repeat_end_date as repeatEndDate,
               created_at as createdAt, updated_at as updatedAt
        FROM meetings WHERE id = ?
    `);
    return stmt.get(meetingId) as Meeting | null;
};

/**
 * 获取所有预约会议列表
 */
export const getScheduledMeetings = (userId?: string): Meeting[] => {
    let query = `
        SELECT m.id, m.title, m.password IS NOT NULL as hasPassword,
               m.created_by as createdBy, m.host_id as hostId,
               m.status, m.scheduled_at as scheduledAt, m.duration,
               m.repeat_frequency as repeatFrequency,
               m.created_at as createdAt, m.updated_at as updatedAt
        FROM meetings m
        WHERE m.status IN ('waiting', 'scheduled', 'ongoing')
    `;
    const params: unknown[] = [];

    if (userId) {
        query += ` AND (m.created_by = ? OR EXISTS (
            SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = ?
        ))`;
        params.push(userId, userId);
    }

    query += ` ORDER BY m.scheduled_at ASC, m.created_at DESC`;

    const stmt = db.prepare(query);
    return stmt.all(...params) as Meeting[];
};

/**
 * 获取会议列表（按状态）
 */
export const getMeetingsByStatus = (status: 'ongoing' | 'scheduled' | 'ended', userId?: string, limit = 50): Meeting[] => {
    let query = `
        SELECT id, title, password IS NOT NULL as hasPassword,
               created_by as createdBy, host_id as hostId,
               status, started_at as startedAt, ended_at as endedAt,
               scheduled_at as scheduledAt, duration,
               created_at as createdAt
        FROM meetings
    `;
    const params: unknown[] = [];

    // 根据状态构建查询条件
    if (status === 'scheduled') {
        query += ` WHERE status IN ('waiting', 'scheduled')`;
    } else {
        query += ` WHERE status = ?`;
        params.push(status);
    }

    if (userId) {
        query += ` AND (created_by = ? OR EXISTS (
            SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = meetings.id AND mp.user_id = ?
        ))`;
        params.push(userId, userId);
    }

    query += ` ORDER BY ${status === 'ended' ? 'ended_at DESC' : 'scheduled_at ASC, created_at DESC'} LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    return stmt.all(...params) as Meeting[];
};

/**
 * 更新预约会议
 */
export const updateScheduledMeeting = (
    meetingId: string,
    updates: Partial<Omit<ScheduledMeetingInput, 'createdBy' | 'participants'>>
): Meeting | null => {
    const now = Math.floor(Date.now() / 1000);
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
        setClauses.push('title = ?');
        values.push(updates.title);
    }
    if (updates.password !== undefined) {
        setClauses.push('password = ?');
        values.push(updates.password || null);
    }
    if (updates.scheduledAt !== undefined) {
        setClauses.push('scheduled_at = ?');
        values.push(updates.scheduledAt);
    }
    if (updates.duration !== undefined) {
        setClauses.push('duration = ?');
        values.push(updates.duration);
    }
    if (updates.repeatFrequency !== undefined) {
        setClauses.push('repeat_frequency = ?');
        values.push(updates.repeatFrequency);
    }
    if (updates.repeatEndType !== undefined) {
        setClauses.push('repeat_end_type = ?');
        values.push(updates.repeatEndType);
    }
    if (updates.repeatEndCount !== undefined) {
        setClauses.push('repeat_end_count = ?');
        values.push(updates.repeatEndCount);
    }
    if (updates.repeatEndDate !== undefined) {
        setClauses.push('repeat_end_date = ?');
        values.push(updates.repeatEndDate);
    }

    if (setClauses.length === 0) return getScheduledMeeting(meetingId);

    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(meetingId);

    const stmt = db.prepare(`UPDATE meetings SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return getScheduledMeeting(meetingId);
};

/**
 * 取消预约会议
 */
export const cancelScheduledMeeting = (meetingId: string, userId: string): boolean => {
    const meeting = getScheduledMeeting(meetingId);
    if (!meeting) return false;

    // 只有创建者可以取消
    if (meeting.createdBy !== userId) return false;

    const now = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE meetings SET status = 'ended', ended_at = ?, updated_at = ? WHERE id = ?`)
        .run(now, now, meetingId);

    logMeetingEvent(meetingId, userId, 'meeting.cancelled');
    return true;
};

// ========== 参与人管理 ==========

/**
 * 获取会议参与人列表
 */
export const getMeetingParticipants = (meetingId: string): MeetingParticipant[] => {
    const stmt = db.prepare(`
        SELECT id, meeting_id as meetingId, user_id as userId, user_name as userName,
               email, status, notified_at as notifiedAt, created_at as createdAt
        FROM meeting_participants
        WHERE meeting_id = ?
        ORDER BY created_at ASC
    `);
    return stmt.all(meetingId) as MeetingParticipant[];
};

/**
 * 添加参与人
 */
export const addMeetingParticipant = (params: {
    meetingId: string;
    userId: string;
    userName: string;
    email?: string;
}): MeetingParticipant => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
        INSERT INTO meeting_participants (meeting_id, user_id, user_name, email, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(meeting_id, user_id) DO UPDATE SET user_name = excluded.user_name, email = excluded.email
    `);
    stmt.run(params.meetingId, params.userId, params.userName, params.email || null, now);

    const result = db.prepare(`
        SELECT id, meeting_id as meetingId, user_id as userId, user_name as userName,
               email, status, created_at as createdAt
        FROM meeting_participants WHERE meeting_id = ? AND user_id = ?
    `).get(params.meetingId, params.userId) as MeetingParticipant;

    return result;
};

/**
 * 移除参与人
 */
export const removeMeetingParticipant = (meetingId: string, participantUserId: string): boolean => {
    const result = db.prepare(`DELETE FROM meeting_participants WHERE meeting_id = ? AND user_id = ?`)
        .run(meetingId, participantUserId);
    return result.changes > 0;
};

/**
 * 获取会议的参会人数
 */
export const getMeetingParticipantCount = (meetingId: string): number => {
    const result = db.prepare(`SELECT COUNT(*) as count FROM meeting_participants WHERE meeting_id = ?`)
        .get(meetingId) as { count: number };
    return result.count;
};

