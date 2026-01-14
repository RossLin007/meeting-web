// 智会后端 - 联系人管理服务

import db from '../db/index.js';

// ==================== 类型定义 ====================

export interface ContactGroup {
    id: number;
    userId: string;
    name: string;
    color: string;
    sortOrder: number;
    createdAt: number;
    contactCount?: number;
}

export interface Contact {
    id: number;
    userId: string;
    contactUserId: string;
    contactName: string;
    contactEmail?: string;
    contactAvatar?: string;
    groupId?: number;
    groupName?: string;
    groupColor?: string;
    lastMeetingId?: string;
    lastMeetingDate?: number;
    lastActiveAt?: number;
    meetingCount?: number;
    createdAt: number;
    updatedAt: number;
}

export interface ContactsQueryParams {
    userId: string;
    groupId?: number;
    search?: string;
    page?: number;
    limit?: number;
}

export interface ContactsQueryResult {
    contacts: Contact[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ==================== 联系人分组管理 ====================

/**
 * 创建联系人分组
 */
export const createGroup = (
    userId: string,
    name: string,
    color: string = '#8b5cf6'
): ContactGroup | null => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const maxOrder = db.prepare(`
            SELECT COALESCE(MAX(sort_order), -1) as max_order FROM contact_groups WHERE user_id = ?
        `).get(userId) as { max_order: number };

        const stmt = db.prepare(`
            INSERT INTO contact_groups (user_id, name, color, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(userId, name, color, maxOrder.max_order + 1, now);

        if (result.changes > 0) {
            return {
                id: Number(result.lastInsertRowid),
                userId,
                name,
                color,
                sortOrder: maxOrder.max_order + 1,
                createdAt: now,
                contactCount: 0,
            };
        }
        return null;
    } catch (error) {
        console.error('Create contact group error:', error);
        return null;
    }
};

/**
 * 获取用户的所有分组
 */
export const getGroups = (userId: string): ContactGroup[] => {
    try {
        const rows = db.prepare(`
            SELECT 
                cg.id, cg.user_id as userId, cg.name, cg.color, 
                cg.sort_order as sortOrder, cg.created_at as createdAt,
                (SELECT COUNT(*) FROM contacts c WHERE c.group_id = cg.id) as contactCount
            FROM contact_groups cg
            WHERE cg.user_id = ?
            ORDER BY cg.sort_order ASC
        `).all(userId) as ContactGroup[];

        return rows;
    } catch (error) {
        console.error('Get contact groups error:', error);
        return [];
    }
};

/**
 * 更新分组
 */
export const updateGroup = (
    userId: string,
    groupId: number,
    updates: { name?: string; color?: string; sortOrder?: number }
): boolean => {
    try {
        const setClauses: string[] = [];
        const values: (string | number)[] = [];

        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            values.push(updates.name);
        }
        if (updates.color !== undefined) {
            setClauses.push('color = ?');
            values.push(updates.color);
        }
        if (updates.sortOrder !== undefined) {
            setClauses.push('sort_order = ?');
            values.push(updates.sortOrder);
        }

        if (setClauses.length === 0) return true;

        values.push(groupId, userId);
        const stmt = db.prepare(`
            UPDATE contact_groups 
            SET ${setClauses.join(', ')}
            WHERE id = ? AND user_id = ?
        `);

        const result = stmt.run(...values);
        return result.changes > 0;
    } catch (error) {
        console.error('Update contact group error:', error);
        return false;
    }
};

/**
 * 删除分组（联系人会变为未分组）
 */
export const deleteGroup = (userId: string, groupId: number): boolean => {
    try {
        const result = db.prepare(`
            DELETE FROM contact_groups WHERE id = ? AND user_id = ?
        `).run(groupId, userId);

        return result.changes > 0;
    } catch (error) {
        console.error('Delete contact group error:', error);
        return false;
    }
};

// ==================== 联系人管理 ====================

/**
 * 从历史会议同步联系人
 * 查找所有与当前用户一起参加过会议的其他用户
 */
export const syncContactsFromMeetings = (userId: string): number => {
    try {
        const now = Math.floor(Date.now() / 1000);

        // 查找所有与当前用户一起参加过会议的其他用户
        // 来源1: meeting_members 表（实际参会记录）
        // 来源2: meeting_participants 表（预约参会者）
        const contactsFromMeetings = db.prepare(`
            SELECT DISTINCT 
                mm2.user_id as contact_user_id,
                mm2.user_name as contact_name,
                m.id as last_meeting_id,
                COALESCE(m.started_at, m.created_at) as last_meeting_date
            FROM meeting_members mm1
            INNER JOIN meeting_members mm2 ON mm1.meeting_id = mm2.meeting_id
            INNER JOIN meetings m ON mm1.meeting_id = m.id
            WHERE mm1.user_id = ? 
              AND mm2.user_id != ?
              AND mm2.user_id != ''
            ORDER BY last_meeting_date DESC
        `).all(userId, userId) as Array<{
            contact_user_id: string;
            contact_name: string;
            last_meeting_id: string;
            last_meeting_date: number;
        }>;

        // 也包含预约会议的参与者
        const contactsFromScheduled = db.prepare(`
            SELECT DISTINCT 
                mp2.user_id as contact_user_id,
                mp2.user_name as contact_name,
                m.id as last_meeting_id,
                COALESCE(m.scheduled_at, m.created_at) as last_meeting_date
            FROM meeting_participants mp1
            INNER JOIN meeting_participants mp2 ON mp1.meeting_id = mp2.meeting_id
            INNER JOIN meetings m ON mp1.meeting_id = m.id
            WHERE mp1.user_id = ? 
              AND mp2.user_id != ?
              AND mp2.user_id != ''
        `).all(userId, userId) as Array<{
            contact_user_id: string;
            contact_name: string;
            last_meeting_id: string;
            last_meeting_date: number;
        }>;

        // 合并联系人，去重并保留最新的会议记录
        const contactMap = new Map<string, {
            contact_user_id: string;
            contact_name: string;
            last_meeting_id: string;
            last_meeting_date: number;
        }>();

        for (const contact of [...contactsFromMeetings, ...contactsFromScheduled]) {
            const existing = contactMap.get(contact.contact_user_id);
            if (!existing || (contact.last_meeting_date > existing.last_meeting_date)) {
                contactMap.set(contact.contact_user_id, contact);
            }
        }

        // 插入或更新联系人
        const upsertStmt = db.prepare(`
            INSERT INTO contacts (user_id, contact_user_id, contact_name, last_meeting_id, last_meeting_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, contact_user_id) DO UPDATE SET
                contact_name = COALESCE(excluded.contact_name, contact_name),
                last_meeting_id = CASE WHEN excluded.last_meeting_date > last_meeting_date THEN excluded.last_meeting_id ELSE last_meeting_id END,
                last_meeting_date = CASE WHEN excluded.last_meeting_date > last_meeting_date THEN excluded.last_meeting_date ELSE last_meeting_date END,
                updated_at = excluded.updated_at
        `);

        let syncedCount = 0;
        for (const contact of contactMap.values()) {
            const result = upsertStmt.run(
                userId,
                contact.contact_user_id,
                contact.contact_name,
                contact.last_meeting_id,
                contact.last_meeting_date,
                now,
                now
            );
            if (result.changes > 0) {
                syncedCount++;
            }
        }

        console.log(`✅ 同步联系人完成：用户 ${userId} 同步了 ${syncedCount} 个联系人`);
        return syncedCount;
    } catch (error) {
        console.error('Sync contacts from meetings error:', error);
        return 0;
    }
};

/**
 * 获取联系人列表（支持分组、搜索、分页）
 */
export const getContacts = (params: ContactsQueryParams): ContactsQueryResult => {
    try {
        const { userId, groupId, search, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        let whereClause = 'c.user_id = ?';
        const queryParams: (string | number)[] = [userId];

        if (groupId !== undefined) {
            if (groupId === 0) {
                // 未分组联系人
                whereClause += ' AND c.group_id IS NULL';
            } else {
                whereClause += ' AND c.group_id = ?';
                queryParams.push(groupId);
            }
        }

        if (search) {
            whereClause += ' AND (c.contact_name LIKE ? OR c.contact_email LIKE ?)';
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
        }

        // 获取总数
        const countResult = db.prepare(`
            SELECT COUNT(*) as total FROM contacts c WHERE ${whereClause}
        `).get(...queryParams) as { total: number };

        // 获取联系人列表
        const contacts = db.prepare(`
            SELECT 
                c.id, c.user_id as userId, c.contact_user_id as contactUserId,
                c.contact_name as contactName, c.contact_email as contactEmail,
                c.contact_avatar as contactAvatar, c.group_id as groupId,
                cg.name as groupName, cg.color as groupColor,
                c.last_meeting_id as lastMeetingId, c.last_meeting_date as lastMeetingDate,
                c.last_active_at as lastActiveAt, c.created_at as createdAt, c.updated_at as updatedAt,
                (SELECT COUNT(DISTINCT mm.meeting_id) 
                 FROM meeting_members mm 
                 INNER JOIN meeting_members mm2 ON mm.meeting_id = mm2.meeting_id
                 WHERE mm.user_id = ? AND mm2.user_id = c.contact_user_id) as meetingCount
            FROM contacts c
            LEFT JOIN contact_groups cg ON c.group_id = cg.id
            WHERE ${whereClause}
            ORDER BY c.last_meeting_date DESC, c.contact_name ASC
            LIMIT ? OFFSET ?
        `).all(userId, ...queryParams, limit, offset) as Contact[];

        return {
            contacts,
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit),
        };
    } catch (error) {
        console.error('Get contacts error:', error);
        return { contacts: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
};

/**
 * 获取单个联系人详情
 */
export const getContactById = (userId: string, contactId: number): Contact | null => {
    try {
        const contact = db.prepare(`
            SELECT 
                c.id, c.user_id as userId, c.contact_user_id as contactUserId,
                c.contact_name as contactName, c.contact_email as contactEmail,
                c.contact_avatar as contactAvatar, c.group_id as groupId,
                cg.name as groupName, cg.color as groupColor,
                c.last_meeting_id as lastMeetingId, c.last_meeting_date as lastMeetingDate,
                c.last_active_at as lastActiveAt, c.created_at as createdAt, c.updated_at as updatedAt,
                (SELECT COUNT(DISTINCT mm.meeting_id) 
                 FROM meeting_members mm 
                 INNER JOIN meeting_members mm2 ON mm.meeting_id = mm2.meeting_id
                 WHERE mm.user_id = ? AND mm2.user_id = c.contact_user_id) as meetingCount
            FROM contacts c
            LEFT JOIN contact_groups cg ON c.group_id = cg.id
            WHERE c.id = ? AND c.user_id = ?
        `).get(userId, contactId, userId) as Contact | undefined;

        return contact || null;
    } catch (error) {
        console.error('Get contact by id error:', error);
        return null;
    }
};

/**
 * 更新联系人信息
 */
export const updateContact = (
    userId: string,
    contactId: number,
    updates: { contactName?: string; contactEmail?: string; contactAvatar?: string; groupId?: number | null }
): boolean => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const setClauses: string[] = ['updated_at = ?'];
        const values: (string | number | null)[] = [now];

        if (updates.contactName !== undefined) {
            setClauses.push('contact_name = ?');
            values.push(updates.contactName);
        }
        if (updates.contactEmail !== undefined) {
            setClauses.push('contact_email = ?');
            values.push(updates.contactEmail);
        }
        if (updates.contactAvatar !== undefined) {
            setClauses.push('contact_avatar = ?');
            values.push(updates.contactAvatar);
        }
        if (updates.groupId !== undefined) {
            setClauses.push('group_id = ?');
            values.push(updates.groupId);
        }

        values.push(contactId, userId);
        const stmt = db.prepare(`
            UPDATE contacts 
            SET ${setClauses.join(', ')}
            WHERE id = ? AND user_id = ?
        `);

        const result = stmt.run(...values);
        return result.changes > 0;
    } catch (error) {
        console.error('Update contact error:', error);
        return false;
    }
};

/**
 * 删除联系人
 */
export const deleteContact = (userId: string, contactId: number): boolean => {
    try {
        const result = db.prepare(`
            DELETE FROM contacts WHERE id = ? AND user_id = ?
        `).run(contactId, userId);

        return result.changes > 0;
    } catch (error) {
        console.error('Delete contact error:', error);
        return false;
    }
};

/**
 * 设置联系人分组
 */
export const setContactGroup = (
    userId: string,
    contactId: number,
    groupId: number | null
): boolean => {
    return updateContact(userId, contactId, { groupId });
};

/**
 * 获取与联系人的历史会议记录
 */
export const getContactMeetingHistory = (
    userId: string,
    contactUserId: string,
    limit: number = 10
): Array<{
    id: string;
    title: string;
    status: string;
    startedAt?: number;
    endedAt?: number;
    duration?: number;
}> => {
    try {
        const meetings = db.prepare(`
            SELECT DISTINCT 
                m.id, m.title, m.status, m.started_at as startedAt, 
                m.ended_at as endedAt, m.duration
            FROM meetings m
            INNER JOIN meeting_members mm1 ON m.id = mm1.meeting_id
            INNER JOIN meeting_members mm2 ON m.id = mm2.meeting_id
            WHERE mm1.user_id = ? AND mm2.user_id = ?
            ORDER BY COALESCE(m.started_at, m.created_at) DESC
            LIMIT ?
        `).all(userId, contactUserId, limit) as Array<{
            id: string;
            title: string;
            status: string;
            startedAt?: number;
            endedAt?: number;
            duration?: number;
        }>;

        return meetings;
    } catch (error) {
        console.error('Get contact meeting history error:', error);
        return [];
    }
};

/**
 * 获取联系人总数（用于统计）
 */
export const getContactCount = (userId: string, groupId?: number): number => {
    try {
        let query = 'SELECT COUNT(*) as count FROM contacts WHERE user_id = ?';
        const params: (string | number)[] = [userId];

        if (groupId !== undefined) {
            if (groupId === 0) {
                query += ' AND group_id IS NULL';
            } else {
                query += ' AND group_id = ?';
                params.push(groupId);
            }
        }

        const result = db.prepare(query).get(...params) as { count: number };
        return result.count;
    } catch (error) {
        console.error('Get contact count error:', error);
        return 0;
    }
};

export default {
    // 分组管理
    createGroup,
    getGroups,
    updateGroup,
    deleteGroup,
    // 联系人管理
    syncContactsFromMeetings,
    getContacts,
    getContactById,
    updateContact,
    deleteContact,
    setContactGroup,
    getContactMeetingHistory,
    getContactCount,
};
