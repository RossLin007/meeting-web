// 智会后端 - 数据库初始化和迁移

import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'meeting.db');

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接
const db: DatabaseType = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表结构
const createTables = (): void => {
    // 用户表
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
    `);

    // 用户偏好设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY,
            theme TEXT DEFAULT 'blue',
            language TEXT DEFAULT 'zh-CN',
            default_mic_on INTEGER NOT NULL DEFAULT 1,
            default_camera_on INTEGER NOT NULL DEFAULT 1,
            default_mic_device TEXT,
            default_camera_device TEXT,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
    `);

    // 会议表
    db.exec(`
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            password TEXT,
            created_by TEXT NOT NULL,
            host_id TEXT NOT NULL,
            im_group_id TEXT,
            status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'scheduled', 'ongoing', 'ended')),
            started_at INTEGER,
            ended_at INTEGER,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
    `);

    // 会议设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS meeting_settings (
            meeting_id TEXT PRIMARY KEY,
            mute_on_join INTEGER NOT NULL DEFAULT 0,
            allow_screen_share INTEGER NOT NULL DEFAULT 1,
            allow_chat INTEGER NOT NULL DEFAULT 1,
            waiting_room INTEGER NOT NULL DEFAULT 0,
            max_participants INTEGER NOT NULL DEFAULT 100,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    `);

    // 会议成员表
    db.exec(`
        CREATE TABLE IF NOT EXISTS meeting_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('host', 'cohost', 'member')),
            is_muted INTEGER NOT NULL DEFAULT 0,
            is_camera_off INTEGER NOT NULL DEFAULT 0,
            joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            left_at INTEGER,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    `);

    // 创建索引：查询在线成员
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_meeting_members_online 
        ON meeting_members(meeting_id, left_at)
    `);

    // 录制记录表
    db.exec(`
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            meeting_id TEXT NOT NULL,
            started_by TEXT NOT NULL,
            started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            ended_at INTEGER,
            duration INTEGER,
            file_url TEXT,
            file_size INTEGER,
            status TEXT NOT NULL DEFAULT 'recording' CHECK(status IN ('recording', 'completed', 'failed')),
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    `);

    // 聊天消息表
    db.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            meeting_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'file')),
            file_url TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    `);

    // 创建索引：按会议查询消息
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting 
        ON chat_messages(meeting_id, created_at)
    `);

    // 会议事件日志表
    db.exec(`
        CREATE TABLE IF NOT EXISTS meeting_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT NOT NULL,
            user_id TEXT,
            event_type TEXT NOT NULL,
            target_user_id TEXT,
            data TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    `);

    // 创建索引：按会议查询事件
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_meeting_events_meeting 
        ON meeting_events(meeting_id, created_at)
    `);

    console.log('✅ 数据库表结构创建完成（8张表）');
};

// 数据库迁移：添加新字段
const runMigrations = (): void => {
    try {
        const columns = db.pragma('table_info(meetings)') as Array<{ name: string }>;
        const columnNames = new Set(columns.map(col => col.name));

        // 迁移 1: 添加 im_group_id 列
        if (!columnNames.has('im_group_id')) {
            console.log('🔄 运行迁移：添加 im_group_id 列到 meetings 表...');
            db.exec(`ALTER TABLE meetings ADD COLUMN im_group_id TEXT`);
            console.log('✅ 迁移完成：im_group_id 列已添加');
        }

        // 迁移 2: 添加预约会议字段
        if (!columnNames.has('scheduled_at')) {
            console.log('🔄 运行迁移：添加预约会议字段到 meetings 表...');
            db.exec(`ALTER TABLE meetings ADD COLUMN scheduled_at INTEGER`);
            db.exec(`ALTER TABLE meetings ADD COLUMN duration INTEGER DEFAULT 30`);
            db.exec(`ALTER TABLE meetings ADD COLUMN repeat_frequency TEXT DEFAULT 'none'`);
            db.exec(`ALTER TABLE meetings ADD COLUMN repeat_end_type TEXT DEFAULT 'never'`);
            db.exec(`ALTER TABLE meetings ADD COLUMN repeat_end_count INTEGER`);
            db.exec(`ALTER TABLE meetings ADD COLUMN repeat_end_date INTEGER`);
            console.log('✅ 迁移完成：预约会议字段已添加');
        }

        // 迁移 3: 创建会议参与人表
        db.exec(`
            CREATE TABLE IF NOT EXISTS meeting_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                email TEXT,
                status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'declined')),
                notified_at INTEGER,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
                UNIQUE(meeting_id, user_id)
            )
        `);

        // 创建索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting 
            ON meeting_participants(meeting_id)
        `);

        console.log('✅ 会议参与人表已就绪');

        // 迁移 4: 创建联系人分组表
        db.exec(`
            CREATE TABLE IF NOT EXISTS contact_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#8b5cf6',
                sort_order INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, name)
            )
        `);

        // 创建索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_contact_groups_user 
            ON contact_groups(user_id)
        `);

        console.log('✅ 联系人分组表已就绪');

        // 迁移 5: 创建联系人表
        db.exec(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                contact_user_id TEXT NOT NULL,
                contact_name TEXT NOT NULL,
                contact_email TEXT,
                contact_avatar TEXT,
                group_id INTEGER,
                last_meeting_id TEXT,
                last_meeting_date INTEGER,
                last_active_at INTEGER,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, contact_user_id),
                FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE SET NULL
            )
        `);

        // 创建索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_contacts_user 
            ON contacts(user_id)
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_contacts_group 
            ON contacts(group_id)
        `);

        console.log('✅ 联系人表已就绪');

        // 迁移 6: 增强录制表 - 添加可见性和 TRTC 任务信息
        const recordingColumns = db.pragma('table_info(recordings)') as Array<{ name: string }>;
        const recordingColumnNames = new Set(recordingColumns.map(col => col.name));

        if (!recordingColumnNames.has('visibility')) {
            console.log('🔄 运行迁移：增强录制表...');
            db.exec(`ALTER TABLE recordings ADD COLUMN visibility TEXT DEFAULT 'host_only' CHECK(visibility IN ('host_only', 'all'))`);
            db.exec(`ALTER TABLE recordings ADD COLUMN task_id TEXT`);
            db.exec(`ALTER TABLE recordings ADD COLUMN cos_file_key TEXT`);
            db.exec(`ALTER TABLE recordings ADD COLUMN title TEXT`);
            console.log('✅ 迁移完成：录制表已增强 (visibility, task_id, cos_file_key, title)');
        }

        // 创建录制表索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_recordings_meeting 
            ON recordings(meeting_id)
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_recordings_task 
            ON recordings(task_id)
        `);
        console.log('✅ 录制表索引已就绪');

        // 迁移 6.1: 添加单流录制支持字段
        if (!recordingColumnNames.has('record_mode')) {
            console.log('🔄 运行迁移：添加单流录制支持字段...');
            db.exec(`ALTER TABLE recordings ADD COLUMN record_mode TEXT DEFAULT 'mixed' CHECK(record_mode IN ('mixed', 'single'))`);
            db.exec(`ALTER TABLE recordings ADD COLUMN user_id TEXT`);  // 单流录制时对应的用户
            db.exec(`ALTER TABLE recordings ADD COLUMN user_name TEXT`);  // 用户名称
            db.exec(`ALTER TABLE recordings ADD COLUMN parent_id TEXT REFERENCES recordings(id)`);  // 父录制ID
            console.log('✅ 迁移完成：录制表已添加单流录制支持');
        }

        // 迁移 7: 创建转录相关表
        db.exec(`
            CREATE TABLE IF NOT EXISTS transcriptions (
                id TEXT PRIMARY KEY,
                recording_id TEXT NOT NULL,
                task_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                full_text TEXT,
                error_message TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                completed_at INTEGER,
                FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS transcription_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcription_id TEXT NOT NULL,
                speaker_id INTEGER NOT NULL,
                begin_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                text TEXT NOT NULL,
                FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS speaker_labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcription_id TEXT NOT NULL,
                speaker_id INTEGER NOT NULL,
                label TEXT NOT NULL,
                UNIQUE(transcription_id, speaker_id),
                FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE
            )
        `);

        // 创建转录相关索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transcriptions_recording 
            ON transcriptions(recording_id)
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transcription_segments_transcription 
            ON transcription_segments(transcription_id)
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_speaker_labels_transcription 
            ON speaker_labels(transcription_id)
        `);

        console.log('✅ 转录表已就绪 (transcriptions, transcription_segments, speaker_labels)');

        // 迁移 8: 创建转录任务队列表（用于自动转录触发）
        db.exec(`
            CREATE TABLE IF NOT EXISTS transcription_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                started_at INTEGER,
                completed_at INTEGER,
                FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transcription_tasks_status 
            ON transcription_tasks(status, created_at)
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transcription_tasks_meeting 
            ON transcription_tasks(meeting_id)
        `);

        console.log('✅ 转录任务队列表已就绪 (transcription_tasks)');

        // 迁移 9: 添加转录元数据字段
        const transcriptionColumns = db.pragma('table_info(transcriptions)') as Array<{ name: string }>;
        const transcriptionColumnNames = new Set(transcriptionColumns.map(col => col.name));

        if (!transcriptionColumnNames.has('alibaba_task_id')) {
            console.log('🔄 运行迁移：添加转录元数据字段...');
            // transcriptions 表添加 ASR 元数据
            db.exec(`ALTER TABLE transcriptions ADD COLUMN alibaba_task_id TEXT`);
            db.exec(`ALTER TABLE transcriptions ADD COLUMN submitted_file_url TEXT`);
            db.exec(`ALTER TABLE transcriptions ADD COLUMN submitted_at INTEGER`);
            db.exec(`ALTER TABLE transcriptions ADD COLUMN asr_duration_ms INTEGER`);
            db.exec(`ALTER TABLE transcriptions ADD COLUMN audio_duration_ms INTEGER`);
            db.exec(`ALTER TABLE transcriptions ADD COLUMN word_count INTEGER`);
            console.log('✅ 迁移完成：transcriptions 表已添加 ASR 元数据字段');
        }

        // 迁移 10: 添加任务统计字段
        const taskColumns = db.pragma('table_info(transcription_tasks)') as Array<{ name: string }>;
        const taskColumnNames = new Set(taskColumns.map(col => col.name));

        if (!taskColumnNames.has('total_recordings')) {
            console.log('🔄 运行迁移：添加任务统计字段...');
            // transcription_tasks 表添加统计字段
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN total_recordings INTEGER DEFAULT 0`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN submitted_count INTEGER DEFAULT 0`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN completed_count INTEGER DEFAULT 0`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN failed_count INTEGER DEFAULT 0`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN skipped_count INTEGER DEFAULT 0`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN processing_time_ms INTEGER`);
            console.log('✅ 迁移完成：transcription_tasks 表已添加统计字段');
        }

        // 迁移 11: 创建会议级转录表（预合并结果）
        db.exec(`
            CREATE TABLE IF NOT EXISTS meeting_transcripts (
                id TEXT PRIMARY KEY,
                meeting_id TEXT UNIQUE NOT NULL,
                full_text TEXT,
                segments_json TEXT,
                participants_json TEXT,
                total_duration_ms INTEGER DEFAULT 0,
                total_word_count INTEGER DEFAULT 0,
                recording_count INTEGER DEFAULT 0,
                completed_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                error_message TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting 
            ON meeting_transcripts(meeting_id)
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_status 
            ON meeting_transcripts(status)
        `);

        console.log('✅ 会议级转录表已就绪 (meeting_transcripts)');

        // 迁移 12: 添加 room_id 和 trtc_task_id 字段（支持 roomId + taskId 作为转写任务唯一标识）
        if (!taskColumnNames.has('room_id')) {
            console.log('🔄 运行迁移：添加 room_id 和 trtc_task_id 字段...');

            // transcription_tasks 表添加新字段
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN room_id TEXT`);
            db.exec(`ALTER TABLE transcription_tasks ADD COLUMN trtc_task_id TEXT`);

            // 创建联合唯一索引
            db.exec(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_transcription_tasks_room_trtc 
                ON transcription_tasks(room_id, trtc_task_id) 
                WHERE room_id IS NOT NULL AND trtc_task_id IS NOT NULL
            `);

            console.log('✅ 迁移完成：transcription_tasks 表已添加 room_id 和 trtc_task_id 字段');
        }

        // 迁移 13: meeting_transcripts 表添加 room_id 和 trtc_task_id 字段
        const mtColumns = db.pragma('table_info(meeting_transcripts)') as Array<{ name: string }>;
        const mtColumnNames = new Set(mtColumns.map(col => col.name));

        if (!mtColumnNames.has('room_id')) {
            console.log('🔄 运行迁移：meeting_transcripts 表添加 room_id 和 trtc_task_id 字段...');

            db.exec(`ALTER TABLE meeting_transcripts ADD COLUMN room_id TEXT`);
            db.exec(`ALTER TABLE meeting_transcripts ADD COLUMN trtc_task_id TEXT`);

            // 创建联合索引
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_room_trtc 
                ON meeting_transcripts(room_id, trtc_task_id)
            `);

            console.log('✅ 迁移完成：meeting_transcripts 表已添加 room_id 和 trtc_task_id 字段');
        }
    } catch (error) {
        console.error('❌ 数据库迁移失败:', error);
        throw error;
    }
};

// 初始化数据库
export const initDatabase = (): DatabaseType => {
    try {
        createTables();
        runMigrations();  // 运行数据库迁移
        return db;
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        throw error;
    }
};

// 导出数据库实例
export const getDatabase = (): DatabaseType => db;

export default db;

