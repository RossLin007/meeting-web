// 智会 - 核心类型定义

// ==================== 用户相关 ====================
export interface User {
    userId: string;
    userName: string;
    userSig: string;
    avatar?: string;
}

// ==================== 会议相关 ====================
export interface Meeting {
    roomId: number;
    title: string;
    password?: string;
    hostIds: string[]; // 主持人ID列表，最多4个
    maxMembers: number;
    createdAt: Date;
    scheduledAt?: Date;
    status: MeetingStatus;
}

export type MeetingStatus = 'scheduled' | 'ongoing' | 'ended';

// 会议列表项（首页展示用）
export interface MeetingListItem {
    roomId: string;
    title: string;
    hostName?: string;
    startTime?: Date;
    endTime?: Date;
    duration?: number; // 分钟
    status: MeetingStatus;
    participantCount?: number;
    isHost?: boolean;
    hasRecording?: boolean;
}

export interface MeetingMember {
    userId: string;
    userName: string;
    avatar?: string;
    isHost: boolean;
    isMuted: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    isOnStage: boolean; // 是否在台上（大型会议模式）
    joinedAt: Date;
}

export interface CreateMeetingParams {
    title: string;
    password?: string;
    scheduledAt?: Date;
}

export interface JoinMeetingParams {
    roomId: number;
    password?: string;
}

// ==================== 预约会议相关 ====================
export type RepeatFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export type RepeatEndType = 'never' | 'count' | 'date';

export type MeetingDuration = 15 | 30 | 45 | 60 | 90 | 120 | 'custom';

export interface RepeatSettings {
    frequency: RepeatFrequency;
    endType: RepeatEndType;
    endCount?: number; // 重复次数
    endDate?: string; // 结束日期 (ISO string)
}

export interface Participant {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    lastMeetingDate?: string; // For contacts display
}

export interface ScheduledMeeting {
    id: string;
    title: string;
    password?: string;
    startDate: string; // ISO date string
    startTime: string; // HH:mm format
    duration: number; // 分钟
    repeat: RepeatSettings;
    participants: Participant[];
    createdBy: string;
    createdAt: Date;
}

export interface ScheduleMeetingFormData {
    title: string;
    password: string;
    startDate: string;
    startTime: string;
    duration: MeetingDuration;
    customDuration: number;
    repeat: RepeatSettings;
    participants: Participant[];
}

// ==================== 录制相关 ====================
export interface Recording {
    id: string;
    roomId: number;
    title: string;
    startedAt: Date;
    endedAt?: Date;
    duration?: number; // 秒
    fileUrl?: string;
    transcriptionUrl?: string;
    transcriptionStatus: TranscriptionStatus;
    members: string[]; // 参会者ID列表
}

export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ==================== 聊天相关 ====================

// 富媒体消息附件信息
export interface MessageAttachment {
    url?: string;           // 图片/文件的 URL
    name?: string;          // 文件名
    size?: number;          // 文件大小（字节）
    width?: number;         // 图片宽度
    height?: number;        // 图片高度
    thumbnailUrl?: string;  // 缩略图 URL（用于图片）
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: Date;
    type: MessageType;
    attachment?: MessageAttachment;  // 富媒体消息附件信息
}

export type MessageType = 'text' | 'image' | 'file' | 'system';

// ==================== 主题相关 ====================
export type ThemeColor = 'blue' | 'lightBlue' | 'cyan' | 'red' | 'pink';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeModeConfig {
    // 主色调
    primary: string;
    primaryLight: string;
    primaryDark: string;
    // 背景色
    bgPage: string;
    bgCard: string;
    bgToolbar: string;
    // 文字色
    textPrimary: string;
    textSecondary: string;
}

export interface ThemeConfig {
    name: ThemeColor;
    dark: ThemeModeConfig;
    light: ThemeModeConfig;
}

// ==================== TRTC 相关 ====================
export interface TRTCConfig {
    sdkAppId: number;
    userId: string;
    userSig: string;
    roomId: number;
}

export interface RemoteUser {
    userId: string;
    hasAudio: boolean;
    hasVideo: boolean;
    hasScreenShare: boolean;
}

// ==================== 网络状态 ====================
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface NetworkStats {
    quality: NetworkQuality;
    rtt: number; // 往返时延 (ms)
    upLoss: number; // 上行丢包率 (%)
    downLoss: number; // 下行丢包率 (%)
}

// ==================== 联系人相关 ====================

// 联系人分组
export interface ContactGroup {
    id: number;
    name: string;
    color: string;
    contactCount?: number;
}

// 联系人（扩展 Participant）
export interface Contact extends Participant {
    contactUserId: string;
    group?: ContactGroup;
    groupId?: number;
    groupName?: string;
    groupColor?: string;
    lastMeetingId?: string;
    lastActiveAt?: Date;
    meetingCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// 联系人列表查询参数
export interface ContactsQueryParams {
    groupId?: number;
    search?: string;
    page?: number;
    limit?: number;
}

// 联系人列表响应
export interface ContactsQueryResult {
    contacts: Contact[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// 联系人历史会议记录
export interface ContactMeetingHistory {
    id: string;
    title: string;
    status: string;
    startedAt?: Date;
    endedAt?: Date;
    duration?: number;
}

