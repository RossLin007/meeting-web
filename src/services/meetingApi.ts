// 智会 - 会议 API 服务层

import type { MeetingListItem, MeetingStatus, ScheduleMeetingFormData } from '@/types';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30000; // 30 秒超时

/**
 * API 响应类型
 */
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * 后端返回的会议数据
 */
interface BackendMeeting {
    id: string;
    title: string;
    hasPassword?: boolean;
    createdBy: string;
    hostId: string;
    status: string;
    startedAt?: number;
    endedAt?: number;
    scheduledAt?: number;
    duration?: number;
    repeatFrequency?: string;
    createdAt: number;
    participantCount?: number;
}

/**
 * 转换后端会议数据到前端 MeetingListItem
 */
const transformMeeting = (m: BackendMeeting, currentUserId?: string): MeetingListItem => {
    // 转换 status
    let status: MeetingStatus = 'scheduled';
    if (m.status === 'ongoing') status = 'ongoing';
    else if (m.status === 'ended') status = 'ended';
    else if (m.status === 'waiting' || m.status === 'scheduled') status = 'scheduled';

    return {
        roomId: m.id,
        title: m.title,
        status,
        startTime: m.scheduledAt ? new Date(m.scheduledAt * 1000) : m.startedAt ? new Date(m.startedAt * 1000) : undefined,
        endTime: m.endedAt ? new Date(m.endedAt * 1000) : undefined,
        duration: m.duration,
        participantCount: m.participantCount,
        isHost: currentUserId === m.createdBy,
        hostName: m.createdBy,  // 后续可以从 users 表获取真实名称
    };
};

/**
 * 辅助函数：安全转换日期为 ISO 字符串
 */
const toISOString = (date: Date | string | undefined): string | undefined => {
    if (!date) return undefined;
    if (typeof date === 'string') return new Date(date).toISOString();
    if (date instanceof Date) return date.toISOString();
    return undefined;
};

/**
 * 创建预约会议
 */
export async function scheduleNewMeeting(
    data: ScheduleMeetingFormData,
    userId: string
): Promise<MeetingListItem> {
    // 确保日期格式正确
    const scheduledAt = toISOString(data.startDate);
    if (!scheduledAt) {
        throw new Error('startDate is required');
    }

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings/scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: data.title,
            password: data.password || undefined,
            scheduledAt,
            duration: typeof data.duration === 'number' ? data.duration : 30,
            repeatFrequency: data.repeat?.frequency || 'none',
            repeatEndType: data.repeat?.endType || 'never',
            repeatEndCount: data.repeat?.endCount,
            repeatEndDate: toISOString(data.repeat?.endDate),
            userId,
            participants: data.participants?.map(p => ({
                userId: p.id,
                userName: p.name,
                email: p.email,
            })),
        }),
    }, DEFAULT_TIMEOUT);

    const result: ApiResponse<BackendMeeting> = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to schedule meeting');
    }

    return transformMeeting(result.data, userId);
}

/**
 * 获取会议列表（按状态）
 */
export async function getMeetingsByStatus(
    status: 'ongoing' | 'scheduled' | 'ended',
    userId?: string,
    limit = 50
): Promise<MeetingListItem[]> {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    params.set('limit', limit.toString());

    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/meetings/list/${status}?${params.toString()}`,
        {},
        DEFAULT_TIMEOUT
    );

    const result: ApiResponse<BackendMeeting[]> = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch meetings');
    }

    return result.data.map(m => transformMeeting(m, userId));
}

/**
 * 获取所有会议（分类返回）
 */
export async function getAllMeetingsCategorized(userId?: string): Promise<{
    ongoing: MeetingListItem[];
    scheduled: MeetingListItem[];
    history: MeetingListItem[];
}> {
    const [ongoing, scheduled, history] = await Promise.all([
        getMeetingsByStatus('ongoing', userId),
        getMeetingsByStatus('scheduled', userId),
        getMeetingsByStatus('ended', userId, 20),
    ]);

    return { ongoing, scheduled, history };
}

/**
 * 取消预约会议
 */
export async function cancelScheduledMeeting(meetingId: string, userId: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings/${meetingId}/scheduled`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    }, DEFAULT_TIMEOUT);

    const result: ApiResponse<null> = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to cancel meeting');
    }
}

/**
 * 更新预约会议
 */
export async function updateScheduledMeeting(
    meetingId: string,
    data: Partial<ScheduleMeetingFormData>,
    userId: string
): Promise<MeetingListItem> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings/${meetingId}/scheduled`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: data.title,
            password: data.password,
            scheduledAt: toISOString(data.startDate),
            duration: typeof data.duration === 'number' ? data.duration : undefined,
            repeatFrequency: data.repeat?.frequency,
            repeatEndType: data.repeat?.endType,
            repeatEndCount: data.repeat?.endCount,
            repeatEndDate: toISOString(data.repeat?.endDate),
            userId,
        }),
    }, DEFAULT_TIMEOUT);

    const result: ApiResponse<BackendMeeting> = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update meeting');
    }

    return transformMeeting(result.data, userId);
}

/**
 * 创建即时会议
 */
export async function createInstantMeeting(
    title: string,
    userId: string,
    password?: string
): Promise<{ roomId: string; title: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, password, userId }),
    }, DEFAULT_TIMEOUT);

    const result: ApiResponse<{ id: string; title: string }> = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create meeting');
    }

    return { roomId: result.data.id, title: result.data.title };
}

/**
 * 获取会议详情
 */
export async function getMeetingDetails(meetingId: string): Promise<BackendMeeting | null> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings/${meetingId}`, {}, DEFAULT_TIMEOUT);

    const result: ApiResponse<BackendMeeting> = await response.json();
    if (!result.success) {
        return null;
    }

    return result.data || null;
}
