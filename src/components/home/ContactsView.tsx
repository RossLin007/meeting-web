// 智会 - 联系人视图组件

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common';
import { UsersIcon } from '@/components/icons';
import { ContactDetailCard } from '@/components/contacts/ContactDetailCard';
import type { Contact, ContactGroup } from '@/types';
import styles from '@/pages/Home.module.css';

interface ContactsViewProps {
    contacts: Contact[];
    contactGroups: ContactGroup[];
    selectedGroupId: number | undefined;
    setSelectedGroupId: (id: number | undefined) => void;
    contactSearch: string;
    setContactSearch: (search: string) => void;
    contactsLoading: boolean;
    isSyncing: boolean;
    userId: string;
    onSyncContacts: () => void;
    onUpdate: () => void;
    onDelete: () => void;
}

export function ContactsView({
    contacts,
    contactGroups,
    selectedGroupId,
    setSelectedGroupId,
    contactSearch,
    setContactSearch,
    contactsLoading,
    isSyncing,
    userId,
    onSyncContacts,
    onUpdate,
    onDelete,
}: ContactsViewProps) {
    const { t } = useTranslation();

    return (
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
                    onClick={onSyncContacts}
                    disabled={isSyncing}
                >
                    {isSyncing ? t('contacts.syncing') : t('contacts.sync')}
                </Button>
            </div>

            {/* Group tabs and search */}
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

            {/* Contact list */}
            {contactsLoading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>{t('common.loading')}</span>
                </div>
            ) : contacts.length === 0 ? (
                <div className={styles.emptyState}>
                    <UsersIcon />
                    <p>{t('home.noContacts')}</p>
                    <Button size="sm" onClick={onSyncContacts} disabled={isSyncing}>
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
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

export default ContactsView;
