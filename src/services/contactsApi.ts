// 智会前端 - 联系人 API 服务

import type { Contact, ContactGroup, ContactsQueryParams, ContactsQueryResult, ContactMeetingHistory } from '@/types';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30000;

// ==================== 联系人分组 API ====================

/**
 * 获取用户的所有联系人分组
 */
export async function getGroups(userId: string): Promise<ContactGroup[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/groups?userId=${encodeURIComponent(userId)}`, {}, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        return data.data;
    }
    throw new Error(data.error || 'Failed to get groups');
}

/**
 * 创建联系人分组
 */
export async function createGroup(userId: string, name: string, color?: string): Promise<ContactGroup> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, color }),
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        return data.data;
    }
    throw new Error(data.error || 'Failed to create group');
}

/**
 * 更新联系人分组
 */
export async function updateGroup(
    userId: string,
    groupId: number,
    updates: { name?: string; color?: string }
): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to update group');
    }
}

/**
 * 删除联系人分组
 */
export async function deleteGroup(userId: string, groupId: number): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/groups/${groupId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to delete group');
    }
}

// ==================== 联系人 API ====================

/**
 * 获取联系人列表（支持分组筛选、搜索、分页）
 */
export async function getContacts(userId: string, params?: ContactsQueryParams): Promise<ContactsQueryResult> {
    const searchParams = new URLSearchParams({ userId });
    if (params?.groupId !== undefined) searchParams.set('groupId', String(params.groupId));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts?${searchParams.toString()}`, {}, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        // 转换日期字段
        const contacts = data.data.contacts.map((c: Record<string, unknown>) => ({
            ...c,
            lastMeetingDate: c.lastMeetingDate ? new Date((c.lastMeetingDate as number) * 1000).toISOString().split('T')[0] : undefined,
            lastActiveAt: c.lastActiveAt ? new Date((c.lastActiveAt as number) * 1000) : undefined,
            createdAt: c.createdAt ? new Date((c.createdAt as number) * 1000) : undefined,
            updatedAt: c.updatedAt ? new Date((c.updatedAt as number) * 1000) : undefined,
        }));
        return { ...data.data, contacts };
    }
    throw new Error(data.error || 'Failed to get contacts');
}

/**
 * 从历史会议同步联系人
 */
export async function syncContacts(userId: string): Promise<{ syncedCount: number }> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        return data.data;
    }
    throw new Error(data.error || 'Failed to sync contacts');
}

/**
 * 获取单个联系人详情
 */
export async function getContactById(userId: string, contactId: number): Promise<Contact> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactId}?userId=${encodeURIComponent(userId)}`, {}, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        const c = data.data;
        return {
            ...c,
            lastMeetingDate: c.lastMeetingDate ? new Date(c.lastMeetingDate * 1000).toISOString().split('T')[0] : undefined,
            lastActiveAt: c.lastActiveAt ? new Date(c.lastActiveAt * 1000) : undefined,
        };
    }
    throw new Error(data.error || 'Failed to get contact');
}

/**
 * 更新联系人信息
 */
export async function updateContact(
    userId: string,
    contactId: number,
    updates: { contactName?: string; contactEmail?: string; groupId?: number | null }
): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to update contact');
    }
}

/**
 * 删除联系人
 */
export async function deleteContact(userId: string, contactId: number): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to delete contact');
    }
}

/**
 * 设置联系人分组
 */
export async function setContactGroup(userId: string, contactId: number, groupId: number | null): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactId}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, groupId }),
    }, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to set contact group');
    }
}

/**
 * 获取与联系人的历史会议记录
 */
export async function getContactMeetings(
    userId: string,
    contactId: number,
    limit?: number
): Promise<ContactMeetingHistory[]> {
    const searchParams = new URLSearchParams({ userId });
    if (limit) searchParams.set('limit', String(limit));

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactId}/meetings?${searchParams.toString()}`, {}, DEFAULT_TIMEOUT);
    const data = await res.json();
    if (data.success) {
        return data.data.map((m: Record<string, unknown>) => ({
            ...m,
            startedAt: m.startedAt ? new Date((m.startedAt as number) * 1000) : undefined,
            endedAt: m.endedAt ? new Date((m.endedAt as number) * 1000) : undefined,
        }));
    }
    throw new Error(data.error || 'Failed to get contact meetings');
}

export default {
    // 分组
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    // 联系人
    getContacts,
    syncContacts,
    getContactById,
    updateContact,
    deleteContact,
    setContactGroup,
    getContactMeetings,
};
