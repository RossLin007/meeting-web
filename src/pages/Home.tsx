// 智会 - 首页（仪表板风格）

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input } from '@/components/common';
import { ScheduleMeetingModal } from '@/components/meeting/ScheduleMeetingModal';
import { useMeetingStore } from '@/services/store';
import { useAuth } from '@/contexts/AuthContext';
import { getAllMeetingsCategorized, scheduleNewMeeting } from '@/services/meetingApi';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import * as contactsApi from '@/services/contactsApi';
import { ContactDetailCard } from '@/components/contacts/ContactDetailCard';
import { QuickActions } from '@/components/home';
import {
    HomeIcon, CalendarIcon, UsersIcon, SettingsIcon, VideoIcon,
    ClockIcon, LogoutIcon, GridIcon, ListIcon
} from '@/components/icons';
import type { ScheduleMeetingFormData, MeetingListItem, MeetingStatus, Contact, ContactGroup } from '@/types';
import styles from './Home.module.css';

const DEFAULT_TIMEOUT = 30000;

// 后端 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// MeetingStatus and MeetingListItem are now imported from @/types

export function Home() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const { currentUser, setCurrentUser, meetingList: _meetingList } = useMeetingStore();
    const { user, isLoggedIn, logout, isLoading: authLoading } = useAuth();

    // 侧边栏状态
    const [activeNav, setActiveNav] = useState<'home' | 'meetings' | 'contacts' | 'settings'>('home');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [meetingTab, setMeetingTab] = useState<'ongoing' | 'scheduled' | 'history'>('ongoing');

    // 弹窗状态
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // 表单状态
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingPassword, setMeetingPassword] = useState('');
    const [roomIdToJoin, setRoomIdToJoin] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // 联系人状态
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
    const [contactSearch, setContactSearch] = useState('');
    const [contactsLoading, setContactsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // 会议列表状态（从 API 加载）
    const [ongoingMeetings, setOngoingMeetings] = useState<MeetingListItem[]>([]);
    const [scheduledMeetings, setScheduledMeetings] = useState<MeetingListItem[]>([]);
    const [historyMeetings, setHistoryMeetings] = useState<MeetingListItem[]>([]);
    const [_meetingsLoading, setMeetingsLoading] = useState(false);

    // 加载会议列表
    const loadMeetings = useCallback(async () => {
        if (!user?.id) return;
        setMeetingsLoading(true);
        try {
            const data = await getAllMeetingsCategorized(user.id);
            setOngoingMeetings(data.ongoing);
            setScheduledMeetings(data.scheduled);
            setHistoryMeetings(data.history);
        } catch (error) {
            console.error('加载会议列表失败:', error);
        } finally {
            setMeetingsLoading(false);
        }
    }, [user?.id]);

    // 初始加载会议列表
    useEffect(() => {
        if (isLoggedIn && user?.id) {
            loadMeetings();
        }
    }, [isLoggedIn, user?.id, loadMeetings]);

    // 加载联系人
    const loadContacts = useCallback(async () => {
        if (!user?.id) return;
        setContactsLoading(true);
        try {
            const [contactsResult, groups] = await Promise.all([
                contactsApi.getContacts(user.id, { groupId: selectedGroupId, search: contactSearch }),
                contactsApi.getGroups(user.id),
            ]);
            setContacts(contactsResult.contacts);
            setContactGroups(groups);
        } catch (error) {
            console.error('加载联系人失败:', error);
        } finally {
            setContactsLoading(false);
        }
    }, [user?.id, selectedGroupId, contactSearch]);

    // 初始加载联系人
    useEffect(() => {
        if (isLoggedIn && user?.id && activeNav === 'contacts') {
            loadContacts();
        }
    }, [isLoggedIn, user?.id, activeNav, loadContacts]);

    // 同步联系人
    const handleSyncContacts = async () => {
        if (!user?.id || isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await contactsApi.syncContacts(user.id);
            console.log(`✅ 同步了 ${result.syncedCount} 个联系人`);
            await loadContacts();
        } catch (error) {
            console.error('同步联系人失败:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // 同步 SSO 用户到 useMeetingStore
    useEffect(() => {
        if (isLoggedIn && user) {
            console.log('🔄 同步 SSO 用户到首页:', user.username);
            fetch(`${API_BASE_URL}/api/usersig/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setCurrentUser({
                            userId: user.id,
                            userName: user.username,
                            userSig: data.data.userSig,
                        });
                    }
                })
                .catch((err) => console.error('生成 UserSig 失败:', err));
        }
    }, [isLoggedIn, user, setCurrentUser]);

    useEffect(() => {
        const urlUserId = searchParams.get('userId');
        if (urlUserId && urlUserId !== currentUser.userId) {
            console.log('发现 URL 中的用户 ID:', urlUserId);
            fetch(`${API_BASE_URL}/api/usersig/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: urlUserId }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        console.log('✅ 为用户生成 UserSig 成功:', urlUserId);
                        setCurrentUser({
                            userId: urlUserId,
                            userName: urlUserId,
                            userSig: data.data.userSig,
                        });
                    } else {
                        console.error('生成 UserSig 失败:', data.error);
                    }
                })
                .catch((err) => {
                    console.error('调用 UserSig API 失败:', err);
                });
        }
    }, [searchParams, currentUser.userId, setCurrentUser]);

    // 创建会议
    const handleCreateMeeting = async () => {
        if (isCreating) return;
        setIsCreating(true);

        const actualUserId = user?.id || currentUser.userId;
        const actualUserName = user?.username || currentUser.userName;
        const defaultTitle = actualUserName ? `${actualUserName}${t('home.meetingSuffix')}` : t('meeting.title');
        const titleToUse = meetingTitle || defaultTitle;

        try {
            // 1. 先调用后端创建会议，获取服务器生成的 ID
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/meetings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: titleToUse,
                    password: meetingPassword,
                    userId: actualUserId,
                    userName: actualUserName,
                }),
            }, DEFAULT_TIMEOUT);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '创建会议失败');
            }

            const { data: meeting } = await response.json();
            const roomId = meeting.id;
            console.log('✅ 会议创建成功，ID:', roomId, '主持人:', actualUserId);

            // 2. 尝试创建 IM 群组（使用服务器返回的 ID）
            try {
                const { imService } = await import('@/services/im');
                await imService.init();
                await imService.login(actualUserId, currentUser.userSig);
                await imService.joinGroup(roomId);
                const imGroupId = `meeting_${roomId}`;
                console.log('✅ IM 群组已创建:', imGroupId);
            } catch (imError) {
                console.warn('⚠️ IM 群组创建失败，聊天功能可能不可用:', imError);
            }

            // 3. 跳转到会议室
            navigate(`/meeting/${roomId}?userId=${encodeURIComponent(actualUserId)}&title=${encodeURIComponent(titleToUse)}&password=${meetingPassword}`);
            setShowCreateModal(false);
            setMeetingTitle('');
            setMeetingPassword('');
        } catch (error) {
            console.error('创建会议失败:', error);
            alert(error instanceof Error ? error.message : '创建会议失败，请重试');
        } finally {
            setIsCreating(false);
        }
    };

    // 加入会议
    const handleJoinMeeting = () => {
        if (!roomIdToJoin) return;
        const actualUserId = user?.id || currentUser.userId;
        navigate(`/meeting/${roomIdToJoin}?userId=${encodeURIComponent(actualUserId)}&password=${joinPassword}`);
        setShowJoinModal(false);
        setRoomIdToJoin('');
        setJoinPassword('');
    };

    // 预约会议
    const handleScheduleMeeting = async (data: ScheduleMeetingFormData) => {
        if (!user?.id) return;

        try {
            console.log('📅 预约会议:', data);
            await scheduleNewMeeting(data, user.id);
            console.log('✅ 预约会议成功');
            setShowScheduleModal(false);
            // 重新加载会议列表
            await loadMeetings();
        } catch (error) {
            console.error('❌ 预约会议失败:', error);
            // TODO: 显示错误提示
        }
    };

    // 确认退出登录
    const handleLogout = async () => {
        setIsLoggingOut(true);
        // 添加延迟让用户看到退出动画
        await new Promise(resolve => setTimeout(resolve, 800));
        await logout();
        setIsLoggingOut(false);
        setShowLogoutModal(false);
    };

    // 获取会议状态标签
    const getStatusLabel = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return t('home.ongoing');
            case 'scheduled': return t('home.scheduled');
            case 'ended': return t('home.ended');
            default: return '';
        }
    };

    // 获取会议状态样式
    const getStatusClass = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return styles.statusLive;
            case 'scheduled': return styles.statusSoon;
            case 'ended': return styles.statusEnded;
            default: return '';
        }
    };

    // 获取当前分类的会议（使用 API 数据）
    const getCurrentMeetings = () => {
        switch (meetingTab) {
            case 'ongoing': return ongoingMeetings;
            case 'scheduled': return scheduledMeetings;
            case 'history': return historyMeetings;
            default: return [];
        }
    };

    // 获取当前分类的空状态文案
    const getEmptyMessage = () => {
        switch (meetingTab) {
            case 'ongoing': return t('home.noOngoingMeetings');
            case 'scheduled': return t('home.noScheduledMeetings');
            case 'history': return t('home.noHistoryMeetings');
            default: return t('home.noMeetings');
        }
    };

    // 格式化时间
    const formatTime = (date?: Date) => {
        if (!date) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // 格式化日期
    const formatDate = (date?: Date) => {
        if (!date) return '';
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return t('home.today') || '今天';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return t('home.tomorrow') || '明天';
        }
        return date.toLocaleDateString();
    };

    if (authLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>{t('common.loading')}</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* 左侧边栏 */}
            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    <VideoIcon />
                    <span>{t('home.appName')}</span>
                </div>

                <nav className={styles.nav}>
                    <button
                        className={`${styles.navItem} ${activeNav === 'home' ? styles.active : ''}`}
                        onClick={() => setActiveNav('home')}
                    >
                        <HomeIcon />
                        <span>{t('home.dashboard')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'meetings' ? styles.active : ''}`}
                        onClick={() => setActiveNav('meetings')}
                    >
                        <CalendarIcon />
                        <span>{t('home.meetings')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'contacts' ? styles.active : ''}`}
                        onClick={() => setActiveNav('contacts')}
                    >
                        <UsersIcon />
                        <span>{t('home.contacts')}</span>
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'settings' ? styles.active : ''}`}
                        onClick={() => navigate('/settings')}
                    >
                        <SettingsIcon />
                        <span>{t('home.settings')}</span>
                    </button>
                </nav>

                {/* 用户信息 */}
                <div className={styles.userSection}>
                    {isLoggedIn && user && (
                        <div className={styles.userCard}>
                            <div className={styles.userAvatar}>
                                {user.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className={styles.userInfo}>
                                <span className={styles.userName}>{user.username}</span>
                                <span className={styles.userStatus}>{t('home.online')}</span>
                            </div>
                            <button className={styles.logoutBtn} onClick={() => setShowLogoutModal(true)} title={t('home.logout')}>
                                <LogoutIcon />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* 主内容区 */}
            <main className={styles.main}>
                {/* 顶部标题 */}
                <header className={styles.header}>
                    <h1 className={styles.pageTitle}>
                        {activeNav === 'home' && t('home.dashboard')}
                        {activeNav === 'meetings' && t('home.meetings')}
                        {activeNav === 'contacts' && t('home.contacts')}
                    </h1>
                </header>

                {/* Home 视图 */}
                {activeNav === 'home' && (
                    <>
                        {/* 快捷操作卡片 */}
                        <QuickActions
                            onCreateMeeting={() => setShowCreateModal(true)}
                            onJoinMeeting={() => setShowJoinModal(true)}
                            onScheduleMeeting={() => setShowScheduleModal(true)}
                        />

                        {/* 会议列表 */}
                        <section className={styles.meetingSection}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>
                                    {t('home.upcomingMeetings')}
                                    {[...ongoingMeetings, ...scheduledMeetings].length > 0 && (
                                        <span className={styles.badge}>{[...ongoingMeetings, ...scheduledMeetings].length}</span>
                                    )}
                                </h2>
                                <div className={styles.viewToggle}>
                                    <button
                                        className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <GridIcon />
                                    </button>
                                    <button
                                        className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon />
                                    </button>
                                </div>
                            </div>

                            {/* 显示进行中和即将开始的会议 */}
                            {[...ongoingMeetings, ...scheduledMeetings].length === 0 ? (
                                <div className={styles.emptyState}>
                                    <CalendarIcon />
                                    <p>{t('home.noMeetings')}</p>
                                </div>
                            ) : (
                                <div className={`${styles.meetingGrid} ${viewMode === 'list' ? styles.listView : ''}`}>
                                    {[...ongoingMeetings, ...scheduledMeetings].slice(0, 6).map((meeting) => (
                                        <div key={meeting.roomId} className={styles.meetingCard}>
                                            <div className={styles.meetingCardHeader}>
                                                <div className={styles.meetingDateBadge}>
                                                    {meeting.startTime && (
                                                        <>
                                                            <span className={styles.dateDay}>{meeting.startTime.getDate()}</span>
                                                            <span className={styles.dateMonth}>
                                                                {meeting.startTime.toLocaleDateString('default', { month: 'short' })}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className={`${styles.meetingStatus} ${getStatusClass(meeting.status)}`}>
                                                    {getStatusLabel(meeting.status)}
                                                </div>
                                            </div>
                                            <div className={styles.meetingInfo}>
                                                <h3 className={styles.meetingTitle}>{meeting.title}</h3>
                                                <p className={styles.meetingId}>ID: {meeting.roomId}</p>
                                                {meeting.startTime && (
                                                    <p className={styles.meetingTime}>
                                                        <ClockIcon />
                                                        <span>{formatDate(meeting.startTime)}</span>
                                                        <span className={styles.timeSeparator}>·</span>
                                                        <span>{formatTime(meeting.startTime)}</span>
                                                        {meeting.duration && (
                                                            <>
                                                                <span className={styles.timeSeparator}>·</span>
                                                                <span>{meeting.duration} {t('schedule.minutes') || '分钟'}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={styles.meetingActions}>
                                                <div className={styles.participants}>
                                                    {meeting.participantCount !== undefined && meeting.participantCount > 0 ? (
                                                        <>
                                                            <UsersIcon />
                                                            <span>{meeting.participantCount} {t('home.participants') || '人参与'}</span>
                                                        </>
                                                    ) : (
                                                        <span className={styles.hostBadge}>{t('home.host') || '主持人'}</span>
                                                    )}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                                                >
                                                    {meeting.status === 'ongoing' ? t('home.join') : t('home.start')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {/* Meetings 视图 */}
                {activeNav === 'meetings' && (
                    <section className={styles.meetingSection}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>{t('home.meetingList')}</h2>
                        </div>

                        {/* 标签页切换 */}
                        <div className={styles.meetingTabs}>
                            <button
                                className={`${styles.meetingTab} ${meetingTab === 'ongoing' ? styles.activeTab : ''}`}
                                onClick={() => setMeetingTab('ongoing')}
                            >
                                {t('home.ongoingMeetings')}
                                {ongoingMeetings.length > 0 && (
                                    <span className={styles.tabBadge}>{ongoingMeetings.length}</span>
                                )}
                            </button>
                            <button
                                className={`${styles.meetingTab} ${meetingTab === 'scheduled' ? styles.activeTab : ''}`}
                                onClick={() => setMeetingTab('scheduled')}
                            >
                                {t('home.scheduledMeetings')}
                                {scheduledMeetings.length > 0 && (
                                    <span className={styles.tabBadge}>{scheduledMeetings.length}</span>
                                )}
                            </button>
                            <button
                                className={`${styles.meetingTab} ${meetingTab === 'history' ? styles.activeTab : ''}`}
                                onClick={() => setMeetingTab('history')}
                            >
                                {t('home.historyMeetings')}
                                {historyMeetings.length > 0 && (
                                    <span className={styles.tabBadge}>{historyMeetings.length}</span>
                                )}
                            </button>
                        </div>

                        {/* 会议列表 */}
                        {getCurrentMeetings().length === 0 ? (
                            <div className={styles.emptyState}>
                                <CalendarIcon />
                                <p>{getEmptyMessage()}</p>
                            </div>
                        ) : (
                            <div className={styles.meetingList}>
                                {getCurrentMeetings().map((meeting) => (
                                    <div key={meeting.roomId} className={styles.meetingListItem}>
                                        <div className={styles.meetingListIcon}>
                                            <VideoIcon />
                                        </div>
                                        <div className={styles.meetingListContent}>
                                            <div className={styles.meetingListHeader}>
                                                <h3 className={styles.meetingListTitle}>{meeting.title}</h3>
                                                <span className={`${styles.meetingListStatus} ${getStatusClass(meeting.status)}`}>
                                                    {getStatusLabel(meeting.status)}
                                                </span>
                                            </div>
                                            <div className={styles.meetingListMeta}>
                                                {meeting.hostName && (
                                                    <span>{t('home.host')}: {meeting.hostName}</span>
                                                )}
                                                {meeting.startTime && meetingTab !== 'history' && (
                                                    <span>{formatDate(meeting.startTime)} {formatTime(meeting.startTime)}</span>
                                                )}
                                                {meeting.startTime && meetingTab === 'history' && (
                                                    <span>{meeting.startTime.toLocaleDateString()}</span>
                                                )}
                                                {meeting.duration && (
                                                    <span>{meeting.duration} {t('home.minutes')}</span>
                                                )}
                                                {meeting.participantCount && (
                                                    <span>{meeting.participantCount} 人</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.meetingListActions}>
                                            {meeting.status === 'ongoing' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                                                >
                                                    {t('home.join')}
                                                </Button>
                                            )}
                                            {meeting.status === 'scheduled' && (
                                                <Button
                                                    size="sm"
                                                    variant={meeting.isHost ? 'primary' : 'secondary'}
                                                    onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                                                >
                                                    {meeting.isHost ? t('home.startMeeting') : t('home.join')}
                                                </Button>
                                            )}
                                            {meeting.status === 'ended' && meeting.hasRecording && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => console.log('View recording:', meeting.roomId)}
                                                >
                                                    {t('home.viewRecording')}
                                                </Button>
                                            )}
                                            {meeting.status === 'ended' && !meeting.hasRecording && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                                                >
                                                    {t('home.rejoin')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Contacts 视图 */}
                {activeNav === 'contacts' && (
                    <section className={styles.contactsSection}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>
                                {t('contacts.title')}
                                {contacts.length > 0 && (
                                    <span className={styles.badge}>{contacts.length}</span>
                                )}
                            </h2>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSyncContacts}
                                disabled={isSyncing}
                            >
                                {isSyncing ? t('contacts.syncing') : t('contacts.sync')}
                            </Button>
                        </div>

                        {/* 分组标签和搜索 */}
                        <div className={styles.contactsToolbar}>
                            <div className={styles.groupTabs}>
                                <button
                                    className={`${styles.groupTab} ${selectedGroupId === undefined ? styles.active : ''}`}
                                    onClick={() => setSelectedGroupId(undefined)}
                                >
                                    {t('contacts.all')}
                                </button>
                                <button
                                    className={`${styles.groupTab} ${selectedGroupId === 0 ? styles.active : ''}`}
                                    onClick={() => setSelectedGroupId(0)}
                                >
                                    {t('contacts.noGroup')}
                                </button>
                                {contactGroups.map(group => (
                                    <button
                                        key={group.id}
                                        className={`${styles.groupTab} ${selectedGroupId === group.id ? styles.active : ''}`}
                                        onClick={() => setSelectedGroupId(group.id)}
                                        style={{ '--group-color': group.color } as React.CSSProperties}
                                    >
                                        <span className={styles.groupDot} style={{ backgroundColor: group.color }} />
                                        {group.name}
                                        {group.contactCount !== undefined && group.contactCount > 0 && (
                                            <span className={styles.groupCount}>{group.contactCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                className={styles.contactSearch}
                                placeholder={t('contacts.search')}
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                            />
                        </div>

                        {/* 联系人列表 */}
                        {contactsLoading ? (
                            <div className={styles.loading}>
                                <div className={styles.spinner}></div>
                                <span>{t('common.loading')}</span>
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className={styles.emptyState}>
                                <UsersIcon />
                                <p>{t('home.noContacts')}</p>
                                <Button size="sm" onClick={handleSyncContacts} disabled={isSyncing}>
                                    {t('contacts.sync')}
                                </Button>
                            </div>
                        ) : (
                            <div className={styles.contactsList}>
                                {contacts.map((contact) => (
                                    <ContactDetailCard
                                        key={contact.id}
                                        contact={contact}
                                        groups={contactGroups}
                                        userId={user?.id || ''}
                                        onUpdate={loadContacts}
                                        onDelete={loadContacts}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* 创建会议弹窗 */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('createMeeting.title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleCreateMeeting} loading={isCreating} disabled={isCreating}>
                            {isCreating ? t('common.creating') : t('createMeeting.create')}
                        </Button>
                    </>
                }
            >
                <div className={styles.form}>
                    <Input
                        label={t('createMeeting.meetingTitle')}
                        placeholder={t('createMeeting.meetingTitlePlaceholder')}
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        fullWidth
                    />
                    <Input
                        label={t('createMeeting.setPassword')}
                        placeholder={t('meeting.passwordPlaceholder')}
                        type="password"
                        value={meetingPassword}
                        onChange={(e) => setMeetingPassword(e.target.value)}
                        hint={t('createMeeting.passwordTip')}
                        fullWidth
                    />
                </div>
            </Modal>

            {/* 加入会议弹窗 */}
            <Modal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                title={t('joinMeeting.title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleJoinMeeting} disabled={!roomIdToJoin}>
                            {t('joinMeeting.join')}
                        </Button>
                    </>
                }
            >
                <div className={styles.form}>
                    <Input
                        label={t('meeting.roomId')}
                        placeholder={t('meeting.enterRoomId')}
                        value={roomIdToJoin}
                        onChange={(e) => setRoomIdToJoin(e.target.value)}
                        fullWidth
                    />
                    <Input
                        label={t('meeting.password')}
                        placeholder={t('meeting.enterPassword')}
                        type="password"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        fullWidth
                    />
                </div>
            </Modal>

            {/* 预约会议弹窗 */}
            <ScheduleMeetingModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSchedule={handleScheduleMeeting}
                contacts={contacts}
            />

            {/* 退出登录确认弹窗 */}
            <Modal
                isOpen={showLogoutModal}
                onClose={() => !isLoggingOut && setShowLogoutModal(false)}
                title={t('home.logoutConfirmTitle') || '确认退出'}
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setShowLogoutModal(false)}
                            disabled={isLoggingOut}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <span className={styles.logoutLoading}>
                                    <span className={styles.logoutSpinner}></span>
                                    {t('home.loggingOut') || '退出中...'}
                                </span>
                            ) : (
                                t('home.confirmLogout') || '确认退出'
                            )}
                        </Button>
                    </>
                }
            >
                <div className={styles.logoutContent}>
                    {isLoggingOut ? (
                        <div className={styles.logoutAnimation}>
                            <div className={styles.logoutWave}></div>
                            <p>{t('home.logoutMessage') || '正在安全退出...'}</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.logoutIcon}>
                                <LogoutIcon />
                            </div>
                            <p>{t('home.logoutDescription') || '确定要退出登录吗？退出后需要重新登录才能使用会议功能。'}</p>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}

export default Home;
