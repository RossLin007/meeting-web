// 智会 - 首页仪表板视图组件

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import { QuickActions } from '@/components/home';
import {
    CalendarIcon, UsersIcon, ClockIcon, GridIcon, ListIcon, FilmIcon
} from '@/components/icons';
import type { MeetingListItem, MeetingStatus } from '@/types';
import styles from '@/pages/Home.module.css';

interface HomeViewProps {
    userName: string;
    ongoingMeetings: MeetingListItem[];
    scheduledMeetings: MeetingListItem[];
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    onCreateMeeting: () => void;
    onJoinMeeting: () => void;
    onScheduleMeeting: () => void;
}

export function HomeView({
    userName,
    ongoingMeetings,
    scheduledMeetings,
    viewMode,
    setViewMode,
    onCreateMeeting,
    onJoinMeeting,
    onScheduleMeeting,
}: HomeViewProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Get time-based greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        let timeOfDay: string;
        if (hour < 12) {
            timeOfDay = t('home.morning');
        } else if (hour < 18) {
            timeOfDay = t('home.afternoon');
        } else {
            timeOfDay = t('home.evening');
        }
        return t('home.welcomeGreeting', { time: timeOfDay, name: userName });
    }, [t, userName]);

    // Count today's meetings
    const todayMeetingCount = useMemo(() => {
        const today = new Date();
        const todayStr = today.toDateString();
        const allMeetings = [...ongoingMeetings, ...scheduledMeetings];
        return allMeetings.filter(m => m.startTime && m.startTime.toDateString() === todayStr).length;
    }, [ongoingMeetings, scheduledMeetings]);

    // Get meeting status label
    const getStatusLabel = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return t('home.ongoing');
            case 'scheduled': return t('home.scheduled');
            case 'ended': return t('home.ended');
            default: return '';
        }
    };

    // Get meeting status class
    const getStatusClass = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return styles.statusLive;
            case 'scheduled': return styles.statusSoon;
            case 'ended': return styles.statusEnded;
            default: return '';
        }
    };

    // Format time
    const formatTime = (date?: Date) => {
        if (!date) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Format date
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

    const allMeetings = [...ongoingMeetings, ...scheduledMeetings];

    return (
        <>
            {/* Welcome greeting */}
            <div className={styles.welcomeSection}>
                <h2 className={styles.welcomeGreeting}>{greeting}</h2>
                <p className={styles.todayOverview}>
                    {todayMeetingCount > 0
                        ? t('home.meetingsToday', { count: todayMeetingCount })
                        : t('home.noMeetingsToday')
                    }
                </p>
            </div>

            {/* Quick action cards */}
            <QuickActions
                onCreateMeeting={onCreateMeeting}
                onJoinMeeting={onJoinMeeting}
                onScheduleMeeting={onScheduleMeeting}
            />

            {/* Meeting list */}
            <section className={styles.meetingSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        {t('home.upcomingMeetings')}
                        {allMeetings.length > 0 && (
                            <span className={styles.badge}>{allMeetings.length}</span>
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

                {/* Show ongoing and scheduled meetings */}
                {allMeetings.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CalendarIcon />
                        <p>{t('home.noMeetings')}</p>
                    </div>
                ) : (
                    <div className={`${styles.meetingGrid} ${viewMode === 'list' ? styles.listView : ''}`}>
                        {allMeetings.slice(0, 6).map((meeting) => (
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
                                                    <span>{meeting.duration} {t('home.minutes')}</span>
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
                                                <span>{meeting.participantCount} {t('home.participants')}</span>
                                            </>
                                        ) : (
                                            <span className={styles.hostBadge}>{t('home.host')}</span>
                                        )}
                                    </div>
                                    <div className={styles.cardButtons}>
                                        {/* Recording entry - only for host */}
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
        </>
    );
}

export default HomeView;
