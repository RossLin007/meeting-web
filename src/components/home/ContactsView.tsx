// 智会 - 联系人视图组件

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/components/common';
import { UsersIcon } from '@/components/icons';
import * as contactsApi from '@/services/contactsApi';
import { ContactDetailCard } from '@/components/contacts/ContactDetailCard';
import type { Contact, ContactGroup } from '@/types';
import styles from '@/pages/Home.module.css';

interface ContactsViewProps {
    userId: string;
}

export function ContactsView({ userId }: ContactsViewProps) {
    const { t } = useTranslation();

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
    const [contactSearch, setContactSearch] = useState('');
    const [contactsLoading, setContactsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // 加载联系人
    const loadContacts = useCallback(async () => {
        if (!userId) return;
        setContactsLoading(true);
        try {
            const [contactsResult, groups] = await Promise.all([
                contactsApi.getContacts(userId, { groupId: selectedGroupId, search: contactSearch }),
                contactsApi.getGroups(userId),
            ]);
            setContacts(contactsResult.contacts);
            setContactGroups(groups);
        } catch (error) {
            console.error('加载联系人失败:', error);
        } finally {
            setContactsLoading(false);
        }
    }, [userId, selectedGroupId, contactSearch]);

    // 初始加载联系人
    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    // 同步联系人
    const handleSyncContacts = async () => {
        if (!userId || isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await contactsApi.syncContacts(userId);
            console.log(`✅ 同步了 ${result.syncedCount} 个联系人`);
            await loadContacts();
        } catch (error) {
            console.error('同步联系人失败:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <section className={styles.contactsSection}>
            {/* 分组和搜索 */}
            <div className={styles.contactsHeader}>
                <div className={styles.groupTabs}>
                    <button
                        className={`${styles.groupTab} ${!selectedGroupId ? styles.active : ''}`}
                        onClick={() => setSelectedGroupId(undefined)}
                    >
                        {t('contacts.all')}
                    </button>
                    {contactGroups.map((group) => (
                        <button
                            key={group.id}
                            className={`${styles.groupTab} ${selectedGroupId === group.id ? styles.active : ''}`}
                            onClick={() => setSelectedGroupId(group.id)}
                        >
                            {group.name}
                        </button>
                    ))}
                </div>
                <div className={styles.contactsActions}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSyncContacts}
                        disabled={isSyncing}
                    >
                        {isSyncing ? t('contacts.syncing') : t('contacts.sync')}
                    </Button>
                </div>
            </div>
            <div className={styles.contactSearchBox}>
                <Input
                    placeholder={t('contacts.searchPlaceholder')}
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
                            userId={userId}
                            onUpdate={loadContacts}
                            onDelete={loadContacts}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

export default ContactsView;
