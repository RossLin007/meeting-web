// 智会 - 会议卡片组件

import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import { ClockIcon, UsersIcon } from '@/components/icons/HomeIcons';
import type { MeetingListItem, MeetingStatus } from '@/types';
import styles from './MeetingCard.module.css';

interface MeetingCardProps {
    meeting: MeetingListItem;
    viewMode?: 'grid' | 'list';
    onJoin?: (roomId: string) => void;
}

function MeetingCardComponent({ meeting, viewMode = 'grid', onJoin }: MeetingCardProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

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
            case 'ongoing': return styles.statusOngoing;
            case 'scheduled': return styles.statusScheduled;
            case 'ended': return styles.statusEnded;
            default: return '';
        }
    };

    // 格式化时间
    const formatTime = (date?: Date) => {
        if (!date) return '';
        return date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
    };

    // 格式化日期
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
        return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    };

    const handleClick = () => {
        if (onJoin) {
            onJoin(meeting.roomId);
        } else {
            navigate(`/meeting/${meeting.roomId}`);
        }
    };

    return (
        <div className={`${styles.card} ${viewMode === 'list' ? styles.listView : ''}`}>
            <div className={styles.header}>
                <div className={styles.dateBadge}>
                    {meeting.startTime && (
                        <>
                            <span className={styles.dateDay}>{meeting.startTime.getDate()}</span>
                            <span className={styles.dateMonth}>
                                {meeting.startTime.toLocaleDateString('default', { month: 'short' })}
                            </span>
                        </>
                    )}
                </div>
                <div className={`${styles.status} ${getStatusClass(meeting.status)}`}>
                    {getStatusLabel(meeting.status)}
                </div>
            </div>

            <div className={styles.info}>
                <h3 className={styles.title}>{meeting.title}</h3>
                <p className={styles.id}>ID: {meeting.roomId}</p>
                {meeting.startTime && (
                    <p className={styles.time}>
                        <ClockIcon />
                        <span>{formatDate(meeting.startTime)}</span>
                        <span className={styles.separator}>·</span>
                        <span>{formatTime(meeting.startTime)}</span>
                        {meeting.duration && (
                            <>
                                <span className={styles.separator}>·</span>
                                <span>{meeting.duration} {t('schedule.minutes') || '分钟'}</span>
                            </>
                        )}
                    </p>
                )}
            </div>

            <div className={styles.actions}>
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
                <Button size="sm" onClick={handleClick}>
                    {meeting.status === 'ongoing' ? t('home.join') : t('home.start')}
                </Button>
            </div>
        </div>
    );
}

// 使用 React.memo 优化性能
export const MeetingCard = memo(MeetingCardComponent);

export default MeetingCard;
