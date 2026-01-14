// 智会后端 - Socket.io 权限控制
// 定义角色和权限矩阵

export type MeetingRole = 'host' | 'cohost' | 'member';

export type PermissionAction =
    // === 所有人可执行 ===
    | 'toggle_own_audio'
    | 'toggle_own_video'
    | 'share_screen'
    | 'send_chat'
    | 'leave_meeting'
    | 'raise_hand'

    // === 主持人/联席主持人可执行 ===
    | 'mute_member'
    | 'unmute_member'
    | 'stop_member_video'
    | 'request_member_video'
    | 'rename_member'
    | 'kick_member'
    | 'kick_member_forever'
    | 'start_recording'
    | 'stop_recording'
    | 'lock_meeting'
    | 'manage_waiting_room'
    | 'mute_all'
    | 'unmute_all'
    | 'disable_all_video'
    | 'disable_all_chat'
    | 'control_screen_share'
    | 'assign_co_host'

    // === 仅主持人可执行 ===
    | 'transfer_host'
    | 'end_meeting'
    | 'remove_co_host';

// 权限矩阵
const PERMISSION_MAP: Record<PermissionAction, MeetingRole[]> = {
    // 所有人
    toggle_own_audio: ['host', 'cohost', 'member'],
    toggle_own_video: ['host', 'cohost', 'member'],
    share_screen: ['host', 'cohost', 'member'],
    send_chat: ['host', 'cohost', 'member'],
    leave_meeting: ['host', 'cohost', 'member'],
    raise_hand: ['host', 'cohost', 'member'],

    // 主持人/联席主持人
    mute_member: ['host', 'cohost'],
    unmute_member: ['host', 'cohost'],
    stop_member_video: ['host', 'cohost'],
    request_member_video: ['host', 'cohost'],
    rename_member: ['host', 'cohost'],
    kick_member: ['host', 'cohost'],
    kick_member_forever: ['host', 'cohost'],
    start_recording: ['host', 'cohost'],
    stop_recording: ['host', 'cohost'],
    lock_meeting: ['host', 'cohost'],
    manage_waiting_room: ['host', 'cohost'],
    mute_all: ['host', 'cohost'],
    unmute_all: ['host', 'cohost'],
    disable_all_video: ['host', 'cohost'],
    disable_all_chat: ['host', 'cohost'],
    control_screen_share: ['host', 'cohost'],
    assign_co_host: ['host', 'cohost'],

    // 仅主持人
    transfer_host: ['host'],
    end_meeting: ['host'],
    remove_co_host: ['host'],
};

/**
 * 检查用户是否有权限执行某个操作
 */
export function canPerformAction(role: MeetingRole, action: PermissionAction): boolean {
    const allowedRoles = PERMISSION_MAP[action];
    return allowedRoles?.includes(role) ?? false;
}

/**
 * 检查用户是否是管理员（主持人或联席主持人）
 */
export function isAdminRole(role: MeetingRole): boolean {
    return role === 'host' || role === 'cohost';
}

/**
 * 检查用户是否是主持人
 */
export function isHostRole(role: MeetingRole): boolean {
    return role === 'host';
}

/**
 * 获取角色的中文名称
 */
export function getRoleName(role: MeetingRole): string {
    switch (role) {
        case 'host': return '主持人';
        case 'cohost': return '联席主持人';
        case 'member': return '参会者';
        default: return '未知';
    }
}
