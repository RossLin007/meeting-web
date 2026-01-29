// 智会 - 会议列表视图组件

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import { CalendarIcon, VideoIcon, FilmIcon } from '@/components/icons';
import type { MeetingListItem, MeetingStatus } from '@/types';
import styles from '@/pages/Home.module.css';

interface MeetingsViewProps {
    meetingTab: 'ongoing' | 'scheduled' | 'history';
    setMeetingTab: (tab: 'ongoing' | 'scheduled' | 'history') => void;
    ongoingMeetings: MeetingListItem[];
    scheduledMeetings: MeetingListItem[];
    historyMeetings: MeetingListItem[];
}

export function MeetingsView({
    meetingTab,
    setMeetingTab,
    ongoingMeetings,
    scheduledMeetings,
    historyMeetings,
}: MeetingsViewProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Get current meetings based on tab
    const getCurrentMeetings = () => {
        switch (meetingTab) {
            case 'ongoing': return ongoingMeetings;
            case 'scheduled': return scheduledMeetings;
            case 'history': return historyMeetings;
            default: return [];
        }
    };

    // Get empty message based on tab
    const getEmptyMessage = () => {
        switch (meetingTab) {
            case 'ongoing': return t('home.noOngoingMeetings');
            case 'scheduled': return t('home.noScheduledMeetings');
            case 'history': return t('home.noHistoryMeetings');
            default: return t('home.noMeetings');
        }
    };

    // Get status label
    const getStatusLabel = (status: MeetingStatus) => {
        switch (status) {
            case 'ongoing': return t('home.ongoing');
            case 'scheduled': return t('home.scheduled');
            case 'ended': return t('home.ended');
            default: return '';
        }
    };

    // Get status class
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

    const currentMeetings = getCurrentMeetings();

    return (
        <section className={styles.meetingSection}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{t('home.meetingList')}</h2>
            </div>

            {/* Tab switcher */}
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

            {/* Meeting list */}
            {currentMeetings.length === 0 ? (
                <div className={styles.emptyState}>
                    <CalendarIcon />
                    <p>{getEmptyMessage()}</p>
                </div>
            ) : (
                <div className={styles.meetingList}>
                    {currentMeetings.map((meeting) => (
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
                                        <span>{meeting.participantCount} {t('home.participants')}</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.meetingListActions}>
                                {/* Recording entry - only for host and ended meetings */}
                                {meeting.isHost && meeting.status === 'ended' && (
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
                                {meeting.status === 'ended' && (
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
    );
}

export default MeetingsView;
