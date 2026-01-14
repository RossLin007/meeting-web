// 智会 - URL 参数验证工具

/**
 * 验证 roomId 格式
 * - 只允许数字
 * - 长度限制 1-20
 */
export function validateRoomId(roomId: string | undefined): { valid: boolean; error?: string } {
    if (!roomId) {
        return { valid: false, error: '房间 ID 不能为空' };
    }

    if (!/^\d+$/.test(roomId)) {
        return { valid: false, error: '房间 ID 只能包含数字' };
    }

    if (roomId.length > 20) {
        return { valid: false, error: '房间 ID 过长' };
    }

    return { valid: true };
}

/**
 * 验证 userId 格式
 * - 只允许字母、数字、下划线、连字符
 * - 长度限制 1-64
 */
export function validateUserId(userId: string | null | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!userId) {
        return { valid: true }; // userId 是可选的
    }

    // 清理潜在的 XSS 字符
    const sanitized = userId.replace(/[<>"'&]/g, '');

    if (!/^[\w-]+$/.test(sanitized)) {
        return { valid: false, error: 'userId 包含非法字符' };
    }

    if (sanitized.length > 64) {
        return { valid: false, error: 'userId 过长' };
    }

    return { valid: true, sanitized };
}

/**
 * 验证会议标题
 * - 清理 HTML 标签
 * - 长度限制 1-100
 */
export function validateMeetingTitle(title: string | null | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!title) {
        return { valid: true }; // title 是可选的
    }

    // 清理 HTML 标签和危险字符
    const sanitized = title
        .replace(/<[^>]*>/g, '') // 移除 HTML 标签
        .replace(/[<>"']/g, '') // 移除危险字符
        .trim()
        .slice(0, 100); // 限制长度

    return { valid: true, sanitized };
}

/**
 * 验证会议密码
 * - 只允许字母和数字
 * - 长度限制 4-16
 */
export function validatePassword(password: string | null | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!password) {
        return { valid: true }; // password 是可选的
    }

    // 只保留字母数字
    const sanitized = password.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);

    if (sanitized.length < 4) {
        return { valid: false, error: '密码至少需要 4 位' };
    }

    return { valid: true, sanitized };
}

export default {
    validateRoomId,
    validateUserId,
    validateMeetingTitle,
    validatePassword,
};
