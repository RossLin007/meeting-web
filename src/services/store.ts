// 智会 - 会议 Store (Zustand)

import { create } from 'zustand';
import type { Meeting, MeetingMember, User, ThemeColor } from '@/types';

// 测试用户配置 (MVP 阶段硬编码，优先从 localStorage 读取)
const STORAGE_KEY = 'meeting_current_user';

const getStoredUser = (): User => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load user from localStorage:', e);
    }
    // 默认用户 - 使用加密安全的随机数
    return {
        userId: 'guest_' + crypto.randomUUID(),
        userName: 'Guest',
        userSig: '',
    };
};

interface MeetingState {
    // 当前用户
    currentUser: User;

    // 当前会议
    currentMeeting: Meeting | null;
    members: MeetingMember[];

    // 本地状态
    isMicOn: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;

    // 会议列表
    meetingList: Meeting[];

    // 主题
    theme: ThemeColor;

    // Actions
    setCurrentUser: (user: User) => void;
    setCurrentMeeting: (meeting: Meeting | null) => void;
    addMember: (member: MeetingMember) => void;
    removeMember: (userId: string) => void;
    updateMember: (userId: string, updates: Partial<MeetingMember>) => void;
    setMicOn: (on: boolean) => void;
    setCameraOn: (on: boolean) => void;
    setScreenSharing: (sharing: boolean) => void;
    setMeetingList: (meetings: Meeting[]) => void;
    addMeeting: (meeting: Meeting) => void;
    setTheme: (theme: ThemeColor) => void;
    reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
    // 初始状态
    currentUser: getStoredUser(),
    currentMeeting: null,
    members: [],
    isMicOn: false,
    isCameraOn: false,
    isScreenSharing: false,
    meetingList: [],
    theme: 'blue',

    // Actions - setCurrentUser 同时保存到 localStorage
    setCurrentUser: (user) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        set({ currentUser: user });
    },

    setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),

    addMember: (member) =>
        set((state) => ({
            members: [...state.members.filter((m) => m.userId !== member.userId), member],
        })),

    removeMember: (userId) =>
        set((state) => ({
            members: state.members.filter((m) => m.userId !== userId),
        })),

    updateMember: (userId, updates) =>
        set((state) => ({
            members: state.members.map((m) =>
                m.userId === userId ? { ...m, ...updates } : m
            ),
        })),

    setMicOn: (on) => set({ isMicOn: on }),

    setCameraOn: (on) => set({ isCameraOn: on }),

    setScreenSharing: (sharing) => set({ isScreenSharing: sharing }),

    setMeetingList: (meetings) => set({ meetingList: meetings }),

    addMeeting: (meeting) =>
        set((state) => ({
            meetingList: [...state.meetingList, meeting],
        })),

    setTheme: (theme) => set({ theme }),

    reset: () =>
        set({
            currentMeeting: null,
            members: [],
            isMicOn: false,
            isCameraOn: false,
            isScreenSharing: false,
        }),
}));

// ==================== 精确订阅选择器 ====================
// 使用这些选择器可以避免不必要的重渲染

/** 选择当前用户 */
export const selectCurrentUser = (state: MeetingState) => state.currentUser;

/** 选择当前会议 */
export const selectCurrentMeeting = (state: MeetingState) => state.currentMeeting;

/** 选择成员列表 */
export const selectMembers = (state: MeetingState) => state.members;

/** 选择音视频状态 */
export const selectMediaState = (state: MeetingState) => ({
    isMicOn: state.isMicOn,
    isCameraOn: state.isCameraOn,
    isScreenSharing: state.isScreenSharing,
});

/** 选择主题 */
export const selectTheme = (state: MeetingState) => state.theme;

/** 选择会议列表 */
export const selectMeetingList = (state: MeetingState) => state.meetingList;

// ==================== Actions 选择器 ====================
/** 选择用户操作 */
export const selectUserActions = (state: MeetingState) => ({
    setCurrentUser: state.setCurrentUser,
});

/** 选择媒体操作 */
export const selectMediaActions = (state: MeetingState) => ({
    setMicOn: state.setMicOn,
    setCameraOn: state.setCameraOn,
    setScreenSharing: state.setScreenSharing,
});

export default useMeetingStore;

