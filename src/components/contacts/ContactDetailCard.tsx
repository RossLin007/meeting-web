// 智会 - 联系人详情卡片组件

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import * as contactsApi from '@/services/contactsApi';
import type { Contact, ContactGroup, ContactMeetingHistory } from '@/types';
import styles from './ContactDetailCard.module.css';

// 图标组件
const VideoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const HistoryIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

interface ContactDetailCardProps {
    contact: Contact;
    groups: ContactGroup[];
    userId: string;
    onUpdate?: () => void;
    onDelete?: () => void;
}

export function ContactDetailCard({
    contact,
    groups,
    userId,
    onUpdate,
    onDelete,
}: ContactDetailCardProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const [meetings, setMeetings] = useState<ContactMeetingHistory[]>([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(contact.groupId ?? null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 加载历史会议
    useEffect(() => {
        if (expanded && meetings.length === 0) {
            loadMeetings();
        }
    }, [expanded]);

    const loadMeetings = async () => {
        setLoadingMeetings(true);
        try {
            const data = await contactsApi.getContactMeetings(userId, contact.id as unknown as number, 5);
            setMeetings(data);
        } catch (error) {
            console.error('Failed to load contact meetings:', error);
        } finally {
            setLoadingMeetings(false);
        }
    };

    // 计算在线状态
    const getOnlineStatus = (): 'online' | 'recent' | 'offline' => {
        if (!contact.lastActiveAt) return 'offline';
        const now = Date.now();
        const lastActive = new Date(contact.lastActiveAt).getTime();
        const diffMinutes = (now - lastActive) / (1000 * 60);
        if (diffMinutes < 5) return 'online';
        if (diffMinutes < 60) return 'recent';
        return 'offline';
    };

    // 格式化最后活跃时间
    const formatLastActive = (): string => {
        if (!contact.lastActiveAt) {
            return contact.lastMeetingDate
                ? t('contacts.lastMeeting', { date: contact.lastMeetingDate })
                : '';
        }
        const now = Date.now();
        const lastActive = new Date(contact.lastActiveAt).getTime();
        const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));

        if (diffMinutes < 1) return t('contacts.justNow');
        if (diffMinutes < 60) return t('contacts.minutesAgo', { count: diffMinutes });
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return t('contacts.hoursAgo', { count: diffHours });
        const diffDays = Math.floor(diffHours / 24);
        return t('contacts.daysAgo', { count: diffDays });
    };

    // 发起会议
    const handleStartMeeting = async () => {
        try {
            // 调用后端创建会议，获取服务器生成的 ID
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${API_BASE_URL}/api/meetings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: t('contacts.meetingWith', { name: contact.name }),
                    userId: userId,
                    userName: contact.name,
                }),
            });

            if (!response.ok) {
                throw new Error('创建会议失败');
            }

            const { data: meeting } = await response.json();
            navigate(`/meeting/${meeting.id}?userId=${encodeURIComponent(userId)}&invite=${encodeURIComponent(contact.contactUserId)}`);
        } catch (error) {
            console.error('创建会议失败:', error);
            alert(t('contacts.createMeetingFailed'));
        }
    };

    // 切换分组
    const handleGroupChange = async (groupId: number | null) => {
        try {
            await contactsApi.setContactGroup(userId, contact.id as unknown as number, groupId);
            setSelectedGroupId(groupId);
            onUpdate?.();
        } catch (error) {
            console.error('Failed to update contact group:', error);
        }
    };

    // 删除联系人
    const handleDelete = async () => {
        if (!window.confirm(t('contacts.confirmDelete', { name: contact.name }))) return;

        setIsDeleting(true);
        try {
            await contactsApi.deleteContact(userId, contact.id as unknown as number);
            onDelete?.();
        } catch (error) {
            console.error('Failed to delete contact:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // 格式化会议日期
    const formatMeetingDate = (date?: Date): string => {
        if (!date) return '';
        return new Date(date).toLocaleDateString();
    };

    const onlineStatus = getOnlineStatus();

    return (
        <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
            {/* 基础信息行 */}
            <div className={styles.basicInfo} onClick={() => setExpanded(!expanded)}>
                <div className={styles.avatar}>
                    {contact.name.charAt(0).toUpperCase()}
                    <span className={`${styles.onlineIndicator} ${styles[onlineStatus]}`} />
                </div>

                <div className={styles.info}>
                    <span className={styles.name}>{contact.name}</span>
                    <div className={styles.meta}>
                        {contact.groupName && (
                            <span className={styles.groupBadge}>
                                <span
                                    className={styles.groupColor}
                                    style={{ backgroundColor: contact.groupColor || '#8b5cf6' }}
                                />
                                {contact.groupName}
                            </span>
                        )}
                        <span>{formatLastActive()}</span>
                    </div>
                </div>

                <button
                    className={styles.quickAction}
                    onClick={(e) => { e.stopPropagation(); handleStartMeeting(); }}
                    title={t('contacts.startMeeting')}
                >
                    <VideoIcon />
                </button>

                <span className={`${styles.expandIcon} ${expanded ? styles.expanded : ''}`}>
                    <ChevronDownIcon />
                </span>
            </div>

            {/* 展开详情 */}
            {expanded && (
                <div className={styles.details}>
                    {/* 统计信息 */}
                    <div className={styles.detailSection}>
                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{contact.meetingCount || 0}</span>
                                <span className={styles.statLabel}>{t('contacts.meetingCount')}</span>
                            </div>
                            {contact.email && (
                                <div className={styles.stat}>
                                    <span className={styles.detailValue}>{contact.email}</span>
                                    <span className={styles.statLabel}>{t('contacts.email')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 分组选择 */}
                    <div className={styles.detailSection}>
                        <div className={styles.detailLabel}>{t('contacts.group')}</div>
                        <div className={styles.groupSelect}>
                            <button
                                className={`${styles.groupOption} ${selectedGroupId === null ? styles.selected : ''}`}
                                onClick={() => handleGroupChange(null)}
                            >
                                {t('contacts.noGroup')}
                            </button>
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    className={`${styles.groupOption} ${selectedGroupId === group.id ? styles.selected : ''}`}
                                    onClick={() => handleGroupChange(group.id)}
                                >
                                    <span
                                        className={styles.groupColor}
                                        style={{ backgroundColor: group.color }}
                                    />
                                    {group.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 历史会议 */}
                    <div className={styles.detailSection}>
                        <div className={styles.detailLabel}>{t('contacts.recentMeetings')}</div>
                        {loadingMeetings ? (
                            <div className={styles.loading}>{t('common.loading')}</div>
                        ) : meetings.length === 0 ? (
                            <div className={styles.empty}>{t('contacts.noMeetingHistory')}</div>
                        ) : (
                            <div className={styles.meetingHistory}>
                                {meetings.map(meeting => (
                                    <div key={meeting.id} className={styles.meetingItem}>
                                        <div className={styles.meetingIcon}>
                                            <HistoryIcon />
                                        </div>
                                        <div className={styles.meetingInfo}>
                                            <div className={styles.meetingTitle}>{meeting.title}</div>
                                            <div className={styles.meetingDate}>
                                                {formatMeetingDate(meeting.startedAt)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className={styles.actions}>
                        <Button
                            className={`${styles.actionBtn} ${styles.primary}`}
                            onClick={handleStartMeeting}
                        >
                            <VideoIcon />
                            {t('contacts.startMeeting')}
                        </Button>
                        <button
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <TrashIcon />
                            {t('contacts.delete')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContactDetailCard;
