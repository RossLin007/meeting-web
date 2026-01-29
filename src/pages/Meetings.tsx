// 智会 - 会议列表页

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { getAllMeetingsCategorized } from '@/services/meetingApi';
import { CalendarIcon, UsersIcon, ClockIcon, FilmIcon } from '@/components/icons';
import type { MeetingListItem, MeetingStatus } from '@/types';
import { Layout } from '@/components/Layout';
import styles from './Meetings.module.css';

export function Meetings() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth();

    const [meetingTab, setMeetingTab] = useState<'ongoing' | 'scheduled' | 'history'>('ongoing');
    const [ongoingMeetings, setOngoingMeetings] = useState<MeetingListItem[]>([]);
    const [scheduledMeetings, setScheduledMeetings] = useState<MeetingListItem[]>([]);
    const [historyMeetings, setHistoryMeetings] = useState<MeetingListItem[]>([]);
    const [meetingsLoading, setMeetingsLoading] = useState(false);

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

    useEffect(() => {
        if (isLoggedIn && user?.id) {
            loadMeetings();
        }
    }, [isLoggedIn, user?.id, loadMeetings]);

    const getCurrentMeetings = () => {
        switch (meetingTab) {
            case 'ongoing': return ongoingMeetings;
            case 'scheduled': return scheduledMeetings;
            case 'history': return historyMeetings;
            default: return [];
        }
    };

    const getEmptyMessage = () => {
        switch (meetingTab) {
            case 'ongoing': return t('home.noOngoingMeetings');
            case 'scheduled': return t('home.noScheduledMeetings');
            case 'history': return t('home.noHistoryMeetings');
            default: return t('home.noMeetings');
        }
    };

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
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const currentMeetings = getCurrentMeetings();

    return (
        <Layout title={t('home.meetings')}>
            {/* 分类标签 */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${meetingTab === 'ongoing' ? styles.active : ''}`}
                    onClick={() => setMeetingTab('ongoing')}
                >
                    {t('home.ongoingMeetings')} ({ongoingMeetings.length})
                </button>
                <button
                    className={`${styles.tab} ${meetingTab === 'scheduled' ? styles.active : ''}`}
                    onClick={() => setMeetingTab('scheduled')}
                >
                    {t('home.scheduledMeetings')} ({scheduledMeetings.length})
                </button>
                <button
                    className={`${styles.tab} ${meetingTab === 'history' ? styles.active : ''}`}
                    onClick={() => setMeetingTab('history')}
                >
                    {t('home.historyMeetings')} ({historyMeetings.length})
                </button>
            </div>

            {/* 会议列表 */}
            <section className={styles.meetingSection}>
                {meetingsLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <span>{t('common.loading')}</span>
                    </div>
                ) : currentMeetings.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CalendarIcon />
                        <p>{getEmptyMessage()}</p>
                    </div>
                ) : (
                    <div className={styles.meetingList}>
                        {currentMeetings.map((meeting) => (
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
        </Layout>
    );
}

export default Meetings;
