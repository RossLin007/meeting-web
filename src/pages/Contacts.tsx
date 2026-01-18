// 智会 - 联系人页

import { Layout } from '@/components/Layout';
import { ContactsView } from '@/components/home';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export function Contacts() {
    const { t } = useTranslation();
    const { user } = useAuth();

    return (
        <Layout title={t('home.contacts')}>
            {user?.id ? (
                <ContactsView userId={user.id} />
            ) : (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    {t('common.loading')}
                </div>
            )}
        </Layout>
    );
}

export default Contacts;
