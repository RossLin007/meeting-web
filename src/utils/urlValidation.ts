// 智会 - URL 参数验证工具

import DOMPurify from 'dompurify';

// 验证结果类型
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export interface SanitizedResult extends ValidationResult {
    sanitized?: string;
}

// 验证常量
export const VALIDATION_LIMITS = {
    ROOM_ID_MIN_LENGTH: 1,
    ROOM_ID_MAX_LENGTH: 20,
    USER_ID_MIN_LENGTH: 1,
    USER_ID_MAX_LENGTH: 64,
    MEETING_TITLE_MAX_LENGTH: 100,
    PASSWORD_MIN_LENGTH: 4,
    PASSWORD_MAX_LENGTH: 16,
} as const;

/**
 * 验证 roomId 格式
 * - 只允许数字
 * - 长度限制 1-20
 */
export function validateRoomId(roomId: string | undefined): ValidationResult {
    if (!roomId) {
        return { valid: false, error: '房间 ID 不能为空' };
    }

    if (!/^\d+$/.test(roomId)) {
        return { valid: false, error: '房间 ID 只能包含数字' };
    }

    if (roomId.length > VALIDATION_LIMITS.ROOM_ID_MAX_LENGTH) {
        return { valid: false, error: '房间 ID 过长' };
    }

    return { valid: true };
}

/**
 * 验证 userId 格式
 * - 只允许字母、数字、下划线、连字符
 * - 长度限制 1-64
 */
export function validateUserId(userId: string | null | undefined): SanitizedResult {
    if (!userId) {
        return { valid: true }; // userId 是可选的
    }

    // 使用 DOMPurify 清理潜在的 XSS 字符
    const sanitized = DOMPurify.sanitize(userId, { ALLOWED_TAGS: [] });

    if (!/^[\w-]+$/.test(sanitized)) {
        return { valid: false, error: 'userId 包含非法字符' };
    }

    if (sanitized.length > VALIDATION_LIMITS.USER_ID_MAX_LENGTH) {
        return { valid: false, error: 'userId 过长' };
    }

    return { valid: true, sanitized };
}

/**
 * 验证会议标题
 * - 清理 HTML 标签
 * - 长度限制 1-100
 */
export function validateMeetingTitle(title: string | null | undefined): SanitizedResult {
    if (!title) {
        return { valid: true }; // title 是可选的
    }

    // 使用 DOMPurify 清理 HTML 标签和危险字符
    const sanitized = DOMPurify.sanitize(title, { ALLOWED_TAGS: [] })
        .trim()
        .slice(0, VALIDATION_LIMITS.MEETING_TITLE_MAX_LENGTH);

    return { valid: true, sanitized };
}

/**
 * 验证会议密码
 * - 只允许字母和数字
 * - 长度限制 4-16
 */
export function validatePassword(password: string | null | undefined): SanitizedResult {
    if (!password) {
        return { valid: true }; // password 是可选的
    }

    // 只保留字母数字
    const sanitized = password.replace(/[^a-zA-Z0-9]/g, '').slice(0, VALIDATION_LIMITS.PASSWORD_MAX_LENGTH);

    if (sanitized.length < VALIDATION_LIMITS.PASSWORD_MIN_LENGTH) {
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
