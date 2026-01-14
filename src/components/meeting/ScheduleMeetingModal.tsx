// 智会 - 预约会议弹窗组件

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select, type SelectOption } from '@/components/common';
import type {
    RepeatFrequency,
    RepeatEndType,
    MeetingDuration,
    Participant,
    ScheduleMeetingFormData
} from '@/types';
import styles from './ScheduleMeetingModal.module.css';

// 图标组件
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

interface ScheduleMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (data: ScheduleMeetingFormData) => void;
    contacts?: Participant[];
}

export function ScheduleMeetingModal({
    isOpen,
    onClose,
    onSchedule,
    contacts = []
}: ScheduleMeetingModalProps) {
    const { t } = useTranslation();

    // 表单状态
    const [title, setTitle] = useState('');
    const [password, setPassword] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [startTime, setStartTime] = useState('09:00');
    const [duration, setDuration] = useState<MeetingDuration>(30);
    const [customDuration, setCustomDuration] = useState(60);
    const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
    const [repeatEndType, setRepeatEndType] = useState<RepeatEndType>('never');
    const [repeatEndCount, setRepeatEndCount] = useState(10);
    const [repeatEndDate, setRepeatEndDate] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showParticipantSearch, setShowParticipantSearch] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 时长选项
    const durationOptions: SelectOption[] = useMemo(() => [
        { value: 15, label: t('scheduleMeeting.durationMinutes', { count: 15 }) },
        { value: 30, label: t('scheduleMeeting.durationMinutes', { count: 30 }) },
        { value: 45, label: t('scheduleMeeting.durationMinutes', { count: 45 }) },
        { value: 60, label: t('scheduleMeeting.durationHour', { count: 1 }) },
        { value: 90, label: t('scheduleMeeting.durationMinutes', { count: 90 }) },
        { value: 120, label: t('scheduleMeeting.durationHours', { count: 2 }) },
        { value: 'custom', label: t('scheduleMeeting.customDuration') },
    ], [t]);

    // 重复频率选项
    const repeatOptions: SelectOption[] = useMemo(() => [
        { value: 'none', label: t('scheduleMeeting.repeatNone') },
        { value: 'daily', label: t('scheduleMeeting.repeatDaily') },
        { value: 'weekdays', label: t('scheduleMeeting.repeatWeekdays') },
        { value: 'weekly', label: t('scheduleMeeting.repeatWeekly') },
        { value: 'monthly', label: t('scheduleMeeting.repeatMonthly') },
    ], [t]);

    // 结束重复选项
    const repeatEndOptions: SelectOption[] = useMemo(() => [
        { value: 'never', label: t('scheduleMeeting.endRepeatNever') },
        { value: 'count', label: t('scheduleMeeting.endRepeatAfterCount') },
        { value: 'date', label: t('scheduleMeeting.endRepeatOnDate') },
    ], [t]);

    // 过滤联系人
    const filteredContacts = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return contacts.filter(c =>
            !participants.some(p => p.id === c.id) &&
            (c.name.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query))
        );
    }, [contacts, participants, searchQuery]);

    // 添加参与人
    const addParticipant = (participant: Participant) => {
        setParticipants([...participants, participant]);
        setSearchQuery('');
        setShowParticipantSearch(false);
    };

    // 移除参与人
    const removeParticipant = (id: string) => {
        setParticipants(participants.filter(p => p.id !== id));
    };

    // 重置表单
    const resetForm = () => {
        setTitle('');
        setPassword('');
        setStartDate(new Date().toISOString().split('T')[0]);
        setStartTime('09:00');
        setDuration(30);
        setCustomDuration(60);
        setRepeatFrequency('none');
        setRepeatEndType('never');
        setRepeatEndCount(10);
        setRepeatEndDate('');
        setParticipants([]);
        setSearchQuery('');
        setShowParticipantSearch(false);
    };

    // 提交表单
    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const formData: ScheduleMeetingFormData = {
            title,
            password,
            startDate,
            startTime,
            duration,
            customDuration,
            repeat: {
                frequency: repeatFrequency,
                endType: repeatEndType,
                endCount: repeatEndType === 'count' ? repeatEndCount : undefined,
                endDate: repeatEndType === 'date' ? repeatEndDate : undefined,
            },
            participants,
        };

        try {
            await onSchedule(formData);
            resetForm();
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    // 关闭弹窗
    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={t('scheduleMeeting.title')}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={isSubmitting || !title}
                    >
                        {isSubmitting ? t('scheduleMeeting.scheduling') : t('scheduleMeeting.schedule')}
                    </Button>
                </>
            }
        >
            <div className={styles.form}>
                {/* 会议标题 */}
                <Input
                    label={t('createMeeting.meetingTitle')}
                    placeholder={t('createMeeting.meetingTitlePlaceholder')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                />

                {/* 开始时间 */}
                <div className={styles.row}>
                    <Input
                        label={t('scheduleMeeting.startDate')}
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        fullWidth
                    />
                    <Input
                        label={t('scheduleMeeting.startTime')}
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        fullWidth
                    />
                </div>

                {/* 会议时长 */}
                <Select
                    label={t('scheduleMeeting.duration')}
                    options={durationOptions}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as unknown as MeetingDuration)}
                    fullWidth
                />

                {/* 自定义时长 */}
                {duration === 'custom' && (
                    <Input
                        label={t('scheduleMeeting.customDurationMinutes')}
                        type="number"
                        min={5}
                        max={480}
                        value={customDuration}
                        onChange={(e) => setCustomDuration(Number(e.target.value))}
                        fullWidth
                    />
                )}

                {/* 重复设置 */}
                <Select
                    label={t('scheduleMeeting.repeat')}
                    options={repeatOptions}
                    value={repeatFrequency}
                    onChange={(e) => setRepeatFrequency(e.target.value as RepeatFrequency)}
                    fullWidth
                />

                {/* 结束重复设置 */}
                {repeatFrequency !== 'none' && (
                    <div className={styles.repeatEndSection}>
                        <Select
                            label={t('scheduleMeeting.endRepeat')}
                            options={repeatEndOptions}
                            value={repeatEndType}
                            onChange={(e) => setRepeatEndType(e.target.value as RepeatEndType)}
                            fullWidth
                        />

                        {repeatEndType === 'count' && (
                            <Input
                                label={t('scheduleMeeting.repeatCount')}
                                type="number"
                                min={1}
                                max={100}
                                value={repeatEndCount}
                                onChange={(e) => setRepeatEndCount(Number(e.target.value))}
                                fullWidth
                            />
                        )}

                        {repeatEndType === 'date' && (
                            <Input
                                label={t('scheduleMeeting.endDate')}
                                type="date"
                                value={repeatEndDate}
                                onChange={(e) => setRepeatEndDate(e.target.value)}
                                fullWidth
                            />
                        )}
                    </div>
                )}

                {/* 参与人 */}
                <div className={styles.participantsSection}>
                    <div className={styles.sectionHeader}>
                        <label className={styles.sectionLabel}>{t('scheduleMeeting.participants')}</label>
                        <button
                            className={styles.addBtn}
                            onClick={() => setShowParticipantSearch(!showParticipantSearch)}
                        >
                            <PlusIcon />
                            {t('scheduleMeeting.addParticipant')}
                        </button>
                    </div>

                    {/* 搜索框 */}
                    {showParticipantSearch && (
                        <div className={styles.searchSection}>
                            <div className={styles.searchInput}>
                                <SearchIcon />
                                <input
                                    type="text"
                                    placeholder={t('scheduleMeeting.searchParticipant')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {filteredContacts.length > 0 && (
                                <div className={styles.searchResults}>
                                    {filteredContacts.map((contact) => (
                                        <button
                                            key={contact.id}
                                            className={styles.contactItem}
                                            onClick={() => addParticipant(contact)}
                                        >
                                            <div className={styles.contactAvatar}>
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={styles.contactInfo}>
                                                <span className={styles.contactName}>{contact.name}</span>
                                                {contact.email && (
                                                    <span className={styles.contactEmail}>{contact.email}</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {filteredContacts.length === 0 && searchQuery && (
                                <div className={styles.noResults}>
                                    {t('scheduleMeeting.noContactsFound')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 已选参与人 */}
                    {participants.length > 0 ? (
                        <div className={styles.participantsList}>
                            {participants.map((participant) => (
                                <div key={participant.id} className={styles.participantItem}>
                                    <div className={styles.participantAvatar}>
                                        {participant.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className={styles.participantName}>{participant.name}</span>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeParticipant(participant.id)}
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.noParticipants}>
                            {t('scheduleMeeting.noParticipants')}
                        </div>
                    )}

                    {participants.length > 0 && (
                        <span className={styles.selectedCount}>
                            {t('scheduleMeeting.selectedCount', { count: participants.length })}
                        </span>
                    )}
                </div>

                {/* 密码（可选） */}
                <Input
                    label={t('createMeeting.setPassword')}
                    placeholder={t('meeting.passwordPlaceholder')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hint={t('createMeeting.passwordTip')}
                    fullWidth
                />
            </div>
        </Modal>
    );
}

export default ScheduleMeetingModal;
