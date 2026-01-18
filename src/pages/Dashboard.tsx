// 智会 - 首页仪表板

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input } from '@/components/common';
import { ScheduleMeetingModal } from '@/components/meeting/ScheduleMeetingModal';
import { QuickActions } from '@/components/home';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetingStore } from '@/services/store';
import { getAllMeetingsCategorized, scheduleNewMeeting } from '@/services/meetingApi';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import {
    CalendarIcon, UsersIcon, ClockIcon, GridIcon, ListIcon, FilmIcon
} from '@/components/icons';
import type { ScheduleMeetingFormData, MeetingListItem, MeetingStatus } from '@/types';
import { Layout } from '@/components/Layout';
import styles from './Dashboard.module.css';

const DEFAULT_TIMEOUT = 30000;
const GRACE_PERIOD_MS = 15 * 60 * 1000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function Dashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth();
    const { currentUser } = useMeetingStore();

    // 弹窗状态
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // 表单状态
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingPassword, setMeetingPassword] = useState('');
    const [roomIdToJoin, setRoomIdToJoin] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // 会议列表状态
    const [ongoingMeetings, setOngoingMeetings] = useState<MeetingListItem[]>([]);
    const [scheduledMeetings, setScheduledMeetings] = useState<MeetingListItem[]>([]);
    const [meetingsLoading, setMeetingsLoading] = useState(false);
    const [meetingSearch, setMeetingSearch] = useState('');
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // 加载会议列表
    const loadMeetings = useCallback(async () => {
        if (!user?.id) return;
        setMeetingsLoading(true);
        try {
            const data = await getAllMeetingsCategorized(user.id);
            setOngoingMeetings(data.ongoing);
            setScheduledMeetings(data.scheduled);
            setLastRefreshTime(new Date());
        } catch (error) {
            console.error('加载会议列表失败:', error);
        } finally {
            setMeetingsLoading(false);
        }
    }, [user?.id]);

    // 过滤的即将开始的会议
    const filteredUpcomingMeetings = useMemo(() => {
        const now = new Date();
        return scheduledMeetings.filter((meeting) => {
            if (!meeting.startTime) return true;
            const meetingTime = new Date(meeting.startTime);
            return meetingTime.getTime() > now.getTime() - GRACE_PERIOD_MS;
        });
    }, [scheduledMeetings]);

    useEffect(() => {
        if (isLoggedIn && user?.id) {
            loadMeetings();
        }
    }, [isLoggedIn, user?.id, loadMeetings]);

    // 创建会议
    const handleCreateMeeting = async () => {
        if (isCreating) return;
        setIsCreating(true);

        const actualUserId = user?.id || currentUser.userId;
        const actualUserName = user?.username || currentUser.userName;
        const defaultTitle = actualUserName ? `${actualUserName}${t('home.meetingSuffix')}` : t('meeting.title');
        const titleToUse = meetingTitle || defaultTitle;

        try {
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
            navigate(`/meeting/${meeting.id}?userId=${encodeURIComponent(actualUserId)}&title=${encodeURIComponent(titleToUse)}&password=${meetingPassword}`);
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
            await scheduleNewMeeting(data, user.id);
            setShowScheduleModal(false);
            await loadMeetings();
        } catch (error) {
            console.error('预约会议失败:', error);
        }
    };

    // 获取状态标签和样式
    const getStatusLabel = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return t('home.ongoing');
            case 'scheduled': return t('home.scheduled');
            case 'ended': return t('home.ended');
            default: return '';
        }
    };

    const getStatusClass = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return styles.statusLive;
            case 'scheduled': return styles.statusSoon;
            case 'ended': return styles.statusEnded;
            default: return '';
        }
    };

    const formatTime = (date?: Date) => {
        if (!date) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date?: Date) => {
        if (!date) return '';
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return t('home.today');
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return t('home.tomorrow');
        }
        return date.toLocaleDateString();
    };

    const allMeetings = [...ongoingMeetings, ...filteredUpcomingMeetings];
    const filteredMeetings = meetingSearch.trim()
        ? allMeetings.filter(m =>
            m.title.toLowerCase().includes(meetingSearch.toLowerCase()) ||
            m.roomId.toLowerCase().includes(meetingSearch.toLowerCase())
        )
        : allMeetings;

    return (
        <Layout>
            {/* 欢迎问候 */}
            {user && (
                <div className={styles.welcomeSection}>
                    <h2 className={styles.welcomeGreeting}>
                        {t('home.welcomeGreeting', {
                            time: new Date().getHours() < 12
                                ? t('home.morning')
                                : new Date().getHours() < 18
                                    ? t('home.afternoon')
                                    : t('home.evening'),
                            name: user.username
                        })}
                    </h2>
                    <p className={styles.todayOverview}>
                        {allMeetings.length > 0
                            ? t('home.meetingsToday', { count: allMeetings.length })
                            : t('home.noMeetingsToday')
                        }
                    </p>
                </div>
            )}

            {/* 快捷操作 */}
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
                        {allMeetings.length > 0 && <span className={styles.badge}>{allMeetings.length}</span>}
                    </h2>
                    <div className={styles.sectionControls}>
                        <div className={styles.searchBox}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={t('home.searchMeetings')}
                                value={meetingSearch}
                                onChange={(e) => setMeetingSearch(e.target.value)}
                            />
                        </div>
                        <button
                            className={`${styles.refreshBtn} ${meetingsLoading ? styles.spinning : ''}`}
                            onClick={loadMeetings}
                            disabled={meetingsLoading}
                            title={lastRefreshTime ? t('home.lastRefreshed', { time: lastRefreshTime.toLocaleTimeString() }) : t('home.refresh')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6" />
                                <path d="M1 20v-6h6" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        </button>
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
                </div>

                {filteredMeetings.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CalendarIcon />
                        <h3>{t('home.emptyMeetingsTitle')}</h3>
                        <p>{t('home.emptyMeetingsDesc')}</p>
                        <Button onClick={() => setShowCreateModal(true)}>
                            {t('home.emptyMeetingsAction')}
                        </Button>
                    </div>
                ) : (
                    <div className={`${styles.meetingGrid} ${viewMode === 'list' ? styles.listView : ''}`}>
                        {filteredMeetings.slice(0, 6).map((meeting) => (
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
                                        </p>
                                    )}
                                </div>
                                <div className={styles.meetingActions}>
                                    <div className={styles.participants}>
                                        {meeting.participantCount && meeting.participantCount > 0 ? (
                                            <>
                                                <UsersIcon />
                                                <span>{meeting.participantCount} {t('home.participants')}</span>
                                            </>
                                        ) : (
                                            <span className={styles.hostBadge}>{t('home.host')}</span>
                                        )}
                                    </div>
                                    <div className={styles.cardButtons}>
                                        {meeting.isHost && (
                                            <button
                                                className={styles.recordingBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/recordings?meetingId=${meeting.roomId}`);
                                                }}
                                                title={t('recordings.viewRecording')}
                                            >
                                                <FilmIcon />
                                            </button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                                        >
                                            {meeting.status === 'ongoing' ? t('home.join') : t('home.start')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

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
                        <Button onClick={handleCreateMeeting} loading={isCreating}>
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
                title={t('home.joinMeeting')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleJoinMeeting} disabled={!roomIdToJoin}>
                            {t('home.join')}
                        </Button>
                    </>
                }
            >
                <div className={styles.form}>
                    <Input
                        label={t('join.roomId')}
                        placeholder={t('join.roomIdPlaceholder')}
                        value={roomIdToJoin}
                        onChange={(e) => setRoomIdToJoin(e.target.value)}
                        fullWidth
                    />
                    <Input
                        label={t('join.password')}
                        placeholder={t('join.passwordPlaceholder')}
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
                onSubmit={handleScheduleMeeting}
            />
        </Layout>
    );
}

export default Dashboard;
