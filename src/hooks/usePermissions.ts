// 智会 - 权限管理 Hook

import { useMemo } from 'react';

export type MeetingRole = 'host' | 'co_host' | 'participant';

export interface UsePermissionsOptions {
    userId: string;
    hostId: string;
    coHosts?: string[];
}

export interface UsePermissionsReturn {
    role: MeetingRole;
    isHost: boolean;
    isCoHost: boolean;
    canControl: boolean;  // 主持人或联席主持人

    // 权限检查方法
    canStartRecording: boolean;
    canStopRecording: boolean;
    canEndMeeting: boolean;
    canMuteOthers: boolean;
    canDisableOthersVideo: boolean;
    canKickParticipant: boolean;
    canAssignCoHost: boolean;
    canTransferHost: boolean;
    canShareScreen: boolean;
    canChat: boolean;
    canRaiseHand: boolean;

    // 动态权限检查
    canPerformAction: (action: PermissionAction) => boolean;
}

export type PermissionAction =
    // 所有人
    | 'toggle_own_audio'
    | 'toggle_own_video'
    | 'change_own_name'
    | 'send_chat'
    | 'leave_meeting'
    | 'raise_hand'
    | 'share_screen'
    // 主持人/联席主持人
    | 'mute_others'
    | 'disable_others_video'
    | 'change_others_name'
    | 'kick_participant'
    | 'assign_co_host'
    | 'start_recording'
    | 'stop_recording'
    // 仅主持人
    | 'end_meeting'
    | 'transfer_host';

/**
 * 会议权限管理 Hook
 * 根据用户角色返回权限状态
 */
export function usePermissions({
    userId,
    hostId,
    coHosts = [],
}: UsePermissionsOptions): UsePermissionsReturn {

    const role = useMemo<MeetingRole>(() => {
        if (userId === hostId) return 'host';
        if (coHosts.includes(userId)) return 'co_host';
        return 'participant';
    }, [userId, hostId, coHosts]);

    const isHost = role === 'host';
    const isCoHost = role === 'co_host';
    const canControl = isHost || isCoHost;

    const permissions = useMemo(() => ({
        // 所有人都可以
        canShareScreen: true,
        canChat: true,
        canRaiseHand: true,

        // 主持人/联席主持人可以
        canStartRecording: canControl,
        canStopRecording: canControl,
        canMuteOthers: canControl,
        canDisableOthersVideo: canControl,
        canKickParticipant: canControl,
        canAssignCoHost: canControl,

        // 仅主持人可以
        canEndMeeting: isHost,
        canTransferHost: isHost,
    }), [isHost, canControl]);

    const canPerformAction = (action: PermissionAction): boolean => {
        switch (action) {
            // 所有人都可以
            case 'toggle_own_audio':
            case 'toggle_own_video':
            case 'change_own_name':
            case 'send_chat':
            case 'leave_meeting':
            case 'raise_hand':
            case 'share_screen':
                return true;

            // 主持人/联席主持人可以
            case 'mute_others':
            case 'disable_others_video':
            case 'change_others_name':
            case 'kick_participant':
            case 'assign_co_host':
            case 'start_recording':
            case 'stop_recording':
                return canControl;

            // 仅主持人可以
            case 'end_meeting':
            case 'transfer_host':
                return isHost;

            default:
                return false;
        }
    };

    return {
        role,
        isHost,
        isCoHost,
        canControl,
        ...permissions,
        canPerformAction,
    };
}

export default usePermissions;
