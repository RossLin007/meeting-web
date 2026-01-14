// 智会 - 快速操作区组件

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoIcon, PlusIcon, CalendarIcon } from '@/components/icons/HomeIcons';
import styles from './QuickActions.module.css';

interface QuickActionsProps {
    onCreateMeeting: () => void;
    onJoinMeeting: () => void;
    onScheduleMeeting: () => void;
}

function QuickActionsComponent({ onCreateMeeting, onJoinMeeting, onScheduleMeeting }: QuickActionsProps) {
    const { t } = useTranslation();

    return (
        <section className={styles.container}>
            <button className={`${styles.card} ${styles.cardPurple}`} onClick={onCreateMeeting}>
                <div className={styles.icon}>
                    <VideoIcon />
                </div>
                <div className={styles.content}>
                    <span className={styles.title}>{t('home.newRoom')}</span>
                    <span className={styles.desc}>{t('home.newRoomDesc')}</span>
                </div>
            </button>

            <button className={`${styles.card} ${styles.cardBlue}`} onClick={onJoinMeeting}>
                <div className={styles.icon}>
                    <PlusIcon />
                </div>
                <div className={styles.content}>
                    <span className={styles.title}>{t('home.joinRoom')}</span>
                    <span className={styles.desc}>{t('home.joinRoomDesc')}</span>
                </div>
            </button>

            <button className={`${styles.card} ${styles.cardDark}`} onClick={onScheduleMeeting}>
                <div className={styles.icon}>
                    <CalendarIcon />
                </div>
                <div className={styles.content}>
                    <span className={styles.title}>{t('home.schedule')}</span>
                    <span className={styles.desc}>{t('home.scheduleDesc')}</span>
                </div>
            </button>
        </section>
    );
}

export const QuickActions = memo(QuickActionsComponent);

export default QuickActions;
