// 智会 - 存储管理页（我的录制）

import { Layout } from '@/components/Layout';
import { RecordingsView } from '@/components/home';
import { useTranslation } from 'react-i18next';

export function Storage() {
    const { t } = useTranslation();

    return (
        <Layout title={t('home.myRecordings')}>
            <RecordingsView />
        </Layout>
    );
}

export default Storage;
