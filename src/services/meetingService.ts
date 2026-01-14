// 智会 - 会议 API 服务 (使用 ApiClient)

import { apiClient, type ApiResponse } from './apiClient';
import type { MeetingListItem, ScheduleMeetingFormData } from '@/types';

// ==================== 类型定义 ====================

export interface CreateMeetingRequest {
    title: string;
    password?: string;
    userId: string;
    userName: string;
    imGroupId?: string;
}

export interface CreateMeetingResponse {
    roomId: string;
    title: string;
    hostId: string;
}

export interface JoinMeetingRequest {
    roomId: string;
    userId: string;
    userName: string;
    password?: string;
}

export interface RoomStateResponse {
    hostId: string;
    coHosts: string[];
    isRecording: boolean;
    recordingTaskId?: string;
}

export interface MeetingsCategorizedResponse {
    ongoing: MeetingListItem[];
    scheduled: MeetingListItem[];
    ended: MeetingListItem[];
}

// ==================== API 方法 ====================

/**
 * 创建新会议
 */
export async function createMeeting(data: CreateMeetingRequest): Promise<ApiResponse<CreateMeetingResponse>> {
    return apiClient.post<CreateMeetingResponse>('/api/meetings', data);
}

/**
 * 加入会议
 */
export async function joinMeeting(data: JoinMeetingRequest): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post('/api/meetings/join', data);
}

/**
 * 获取会议详情
 */
export async function getMeeting(roomId: string): Promise<ApiResponse<MeetingListItem>> {
    return apiClient.get<MeetingListItem>(`/api/meetings/${roomId}`);
}

/**
 * 结束会议
 */
export async function endMeeting(roomId: string, userId: string): Promise<ApiResponse<void>> {
    return apiClient.post(`/api/meetings/${roomId}/end`, { userId });
}

/**
 * 获取房间状态
 */
export async function getRoomState(meetingId: string): Promise<ApiResponse<RoomStateResponse>> {
    return apiClient.get<RoomStateResponse>(`/api/meetings/${meetingId}/state`);
}

/**
 * 获取分类会议列表
 */
export async function getMeetingsCategorized(userId: string): Promise<ApiResponse<MeetingsCategorizedResponse>> {
    return apiClient.get<MeetingsCategorizedResponse>('/api/meetings/categorized', { userId });
}

/**
 * 预约会议
 */
export async function scheduleMeeting(data: ScheduleMeetingFormData & { userId: string }): Promise<ApiResponse<CreateMeetingResponse>> {
    return apiClient.post<CreateMeetingResponse>('/api/meetings/schedule', {
        ...data,
    });
}

/**
 * 获取用户信息
 */
export async function getUsers(userIds: string[]): Promise<ApiResponse<Record<string, { name: string }>>> {
    return apiClient.get('/api/users', { ids: userIds.join(',') });
}

/**
 * 生成 UserSig
 */
export async function generateUserSig(userId: string): Promise<ApiResponse<{ userSig: string }>> {
    return apiClient.post('/api/usersig/generate', { userId });
}

// ==================== 录制 API ====================

/**
 * 开始录制
 */
export async function startRecording(roomId: string): Promise<ApiResponse<{ taskId: string }>> {
    return apiClient.post('/api/recording/start', { roomId });
}

/**
 * 停止录制
 */
export async function stopRecording(roomId: string, taskId: string): Promise<ApiResponse<void>> {
    return apiClient.post('/api/recording/stop', { roomId, taskId });
}

/**
 * 获取录制状态
 */
export async function getRecordingStatus(roomId: string): Promise<ApiResponse<{ isRecording: boolean; taskId?: string }>> {
    return apiClient.get('/api/recording/status', { roomId });
}

export default {
    createMeeting,
    joinMeeting,
    getMeeting,
    endMeeting,
    getRoomState,
    getMeetingsCategorized,
    scheduleMeeting,
    getUsers,
    generateUserSig,
    startRecording,
    stopRecording,
    getRecordingStatus,
};
