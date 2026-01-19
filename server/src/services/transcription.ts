// 智会后端 - 语音转文字服务 (阿里云 ASR paraformer-v2)

import { v4 as uuidv4 } from 'uuid';

// 阿里云 DashScope API 配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const TRANSCRIPTION_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
const TASK_STATUS_API_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

// 转录结果类型
export interface TranscriptionSegment {
    speakerId: number;
    beginTime: number;  // ms
    endTime: number;    // ms
    text: string;
}

export interface ParsedTranscript {
    fullText: string;
    segments: TranscriptionSegment[];
    speakerIds: number[];  // 所有出现的说话人ID
}

export interface TranscriptionTask {
    taskId: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    results?: Array<{
        fileUrl: string;
        transcriptionUrl: string;
        subtaskStatus: string;
    }>;
    error?: string;
}

/**
 * 提交转录任务到阿里云
 * 
 * @param fileUrl 录制文件的公开访问 URL (COS)
 * @param speakerCount 说话人数量参考值（可选，2-100）
 * @returns 任务ID
 */
export async function submitTranscription(
    fileUrl: string,
    speakerCount?: number
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    if (!DASHSCOPE_API_KEY) {
        console.error('❌ DASHSCOPE_API_KEY 未配置');
        return { success: false, error: 'DASHSCOPE_API_KEY not configured' };
    }

    console.log('========================================');
    console.log('🎤 提交转录任务 - 阿里云 ASR');
    console.log('========================================');
    console.log(`📁 文件URL: ${fileUrl}`);
    console.log(`👥 说话人数量参考: ${speakerCount || '自动检测'}`);

    try {
        const requestBody: {
            model: string;
            input: { file_urls: string[] };
            parameters: {
                channel_id: number[];
                language_hints: string[];
                diarization_enabled: boolean;
                speaker_count?: number;
            };
        } = {
            model: 'paraformer-v2',
            input: {
                file_urls: [fileUrl],
            },
            parameters: {
                channel_id: [0],
                language_hints: ['zh', 'en'],
                diarization_enabled: true,  // 启用说话人分离
            },
        };

        // 如果提供了说话人数量，添加到参数中
        if (speakerCount && speakerCount >= 2 && speakerCount <= 100) {
            requestBody.parameters.speaker_count = speakerCount;
        }

        console.log('📤 请求参数:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(TRANSCRIPTION_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify(requestBody),
        });

        const result = await response.json() as { message?: string; output?: { task_id?: string; task_status?: string } };

        if (!response.ok) {
            console.error('❌ 提交转录任务失败:', result);
            return {
                success: false,
                error: result.message || `HTTP ${response.status}`,
            };
        }

        const taskId = result.output?.task_id;
        console.log('✅ 转录任务已提交');
        console.log(`   Task ID: ${taskId}`);
        console.log(`   Status: ${result.output?.task_status}`);
        console.log('========================================');

        return { success: true, taskId };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ 提交转录任务异常:', error);
        return { success: false, error: errorMessage };
    }
}

/**
 * 查询转录任务状态
 * 
 * @param taskId 阿里云任务ID
 * @returns 任务状态和结果
 */
export async function queryTranscriptionStatus(taskId: string): Promise<TranscriptionTask> {
    if (!DASHSCOPE_API_KEY) {
        return { taskId, status: 'FAILED', error: 'DASHSCOPE_API_KEY not configured' };
    }

    console.log(`🔍 查询转录任务状态: ${taskId}`);

    try {
        const response = await fetch(`${TASK_STATUS_API_URL}/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            },
        });

        const result = await response.json() as {
            message?: string;
            code?: string;
            output?: {
                task_status?: string;
                message?: string;
                code?: string;
                results?: Array<{ file_url: string; transcription_url: string; subtask_status: string; message?: string }>;
            };
        };

        // 打印完整响应用于调试
        console.log('📥 API 响应:', JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error('❌ 查询任务状态失败:', result);
            return {
                taskId,
                status: 'FAILED',
                error: result.message || `HTTP ${response.status}`,
            };
        }

        const output = result.output || {};
        const status = output.task_status as TranscriptionTask['status'];

        console.log(`📋 任务状态: ${status}`);

        // 如果失败，打印错误详情
        if (status === 'FAILED') {
            console.error('❌ 转录任务失败:');
            console.error(`   Code: ${output.code || result.code}`);
            console.error(`   Message: ${output.message || result.message}`);
            if (output.results) {
                for (const r of output.results) {
                    console.error(`   子任务状态: ${r.subtask_status}, 错误: ${r.message || '无'}`);
                }
            }
        }

        if (status === 'SUCCEEDED' && output.results) {
            console.log(`📁 结果文件数: ${output.results.length}`);
        }

        // 获取失败的错误信息
        let errorMessage: string | undefined;
        if (status === 'FAILED') {
            errorMessage = output.message || result.message || 'Unknown error';
            if (output.results && output.results.length > 0 && output.results[0].message) {
                errorMessage = output.results[0].message;
            }
        }

        return {
            taskId,
            status,
            results: output.results?.map((r: { file_url: string; transcription_url: string; subtask_status: string }) => ({
                fileUrl: r.file_url,
                transcriptionUrl: r.transcription_url,
                subtaskStatus: r.subtask_status,
            })),
            error: errorMessage,
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ 查询任务状态异常:', error);
        return { taskId, status: 'FAILED', error: errorMessage };
    }
}

/**
 * 下载并解析转录结果
 * 
 * @param transcriptionUrl 阿里云返回的转录结果 URL
 * @returns 解析后的转录结果
 */
export async function parseTranscriptionResult(transcriptionUrl: string): Promise<ParsedTranscript> {
    console.log(`📥 下载转录结果: ${transcriptionUrl.substring(0, 100)}...`);

    try {
        const response = await fetch(transcriptionUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as { transcripts?: Array<{ text?: string; sentences?: Array<{ speaker_id?: number; begin_time?: number; end_time?: number; text?: string }> }> };

        // 解析阿里云返回的 JSON 格式
        const transcripts = data.transcripts || [];
        const segments: TranscriptionSegment[] = [];
        const speakerIdSet = new Set<number>();
        let fullText = '';

        for (const transcript of transcripts) {
            // 提取完整文本
            if (transcript.text) {
                fullText += transcript.text + '\n';
            }

            // 提取句子级别的分段
            const sentences = transcript.sentences || [];
            for (const sentence of sentences) {
                const speakerId = sentence.speaker_id ?? 0;
                speakerIdSet.add(speakerId);

                segments.push({
                    speakerId,
                    beginTime: sentence.begin_time || 0,
                    endTime: sentence.end_time || 0,
                    text: sentence.text || '',
                });
            }
        }

        console.log(`✅ 转录结果解析完成`);
        console.log(`   分段数: ${segments.length}`);
        console.log(`   说话人数: ${speakerIdSet.size}`);

        return {
            fullText: fullText.trim(),
            segments,
            speakerIds: Array.from(speakerIdSet).sort((a, b) => a - b),
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ 解析转录结果失败:', error);
        throw new Error(`Failed to parse transcription result: ${errorMessage}`);
    }
}

// ============ 数据库操作 ============

/**
 * 创建转录记录
 */
export async function createTranscriptionRecord(
    recordingId: string,
    taskId: string
): Promise<string> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    const id = uuidv4();
    try {
        db.prepare(`
            INSERT INTO transcriptions (id, recording_id, task_id, status)
            VALUES (?, ?, ?, 'pending')
        `).run(id, recordingId, taskId);

        console.log(`💾 转录记录已创建: ${id}`);
        return id;
    } catch (error) {
        console.error('❌ 创建转录记录失败:', error);
        throw error;
    }
}

/**
 * 更新转录状态
 */
export async function updateTranscriptionStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
): Promise<void> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        if (status === 'completed' || status === 'failed') {
            db.prepare(`
                UPDATE transcriptions 
                SET status = ?, error_message = ?, completed_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(status, errorMessage || null, id);
        } else {
            db.prepare(`
                UPDATE transcriptions SET status = ? WHERE id = ?
            `).run(status, id);
        }

        console.log(`📝 转录状态已更新: ${id} -> ${status}`);
    } catch (error) {
        console.error('❌ 更新转录状态失败:', error);
        throw error;
    }
}

/**
 * 保存转录结果（全文和分段）
 */
export async function saveTranscriptionResult(
    transcriptionId: string,
    result: ParsedTranscript
): Promise<void> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        // 开始事务
        db.exec('BEGIN TRANSACTION');

        // 更新全文
        db.prepare(`
            UPDATE transcriptions SET full_text = ? WHERE id = ?
        `).run(result.fullText, transcriptionId);

        // 清除旧的分段（如果有）
        db.prepare(`DELETE FROM transcription_segments WHERE transcription_id = ?`).run(transcriptionId);

        // 插入新的分段
        const insertSegment = db.prepare(`
            INSERT INTO transcription_segments (transcription_id, speaker_id, begin_time, end_time, text)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const segment of result.segments) {
            insertSegment.run(
                transcriptionId,
                segment.speakerId,
                segment.beginTime,
                segment.endTime,
                segment.text
            );
        }

        // 创建默认的说话人标签
        db.prepare(`DELETE FROM speaker_labels WHERE transcription_id = ?`).run(transcriptionId);

        const insertLabel = db.prepare(`
            INSERT INTO speaker_labels (transcription_id, speaker_id, label)
            VALUES (?, ?, ?)
        `);

        for (const speakerId of result.speakerIds) {
            insertLabel.run(transcriptionId, speakerId, `说话人 ${speakerId + 1}`);
        }

        db.exec('COMMIT');

        console.log(`💾 转录结果已保存: ${transcriptionId}`);
        console.log(`   分段数: ${result.segments.length}`);
        console.log(`   说话人数: ${result.speakerIds.length}`);
    } catch (error) {
        db.exec('ROLLBACK');
        console.error('❌ 保存转录结果失败:', error);
        throw error;
    }
}

/**
 * 获取转录详情（包含分段和说话人标签）
 */
export async function getTranscriptionDetails(transcriptionId: string): Promise<{
    id: string;
    recordingId: string;
    taskId: string | null;
    status: string;
    fullText: string | null;
    errorMessage: string | null;
    createdAt: number;
    completedAt: number | null;
    segments: TranscriptionSegment[];
    speakerLabels: Record<number, string>;
} | null> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        // 获取转录基本信息
        const transcription = db.prepare(`
            SELECT * FROM transcriptions WHERE id = ?
        `).get(transcriptionId) as {
            id: string;
            recording_id: string;
            task_id: string | null;
            status: string;
            full_text: string | null;
            error_message: string | null;
            created_at: number;
            completed_at: number | null;
        } | undefined;

        if (!transcription) {
            return null;
        }

        // 获取分段
        const segments = db.prepare(`
            SELECT speaker_id, begin_time, end_time, text
            FROM transcription_segments
            WHERE transcription_id = ?
            ORDER BY begin_time ASC
        `).all(transcriptionId) as Array<{
            speaker_id: number;
            begin_time: number;
            end_time: number;
            text: string;
        }>;

        // 获取说话人标签
        const labels = db.prepare(`
            SELECT speaker_id, label FROM speaker_labels WHERE transcription_id = ?
        `).all(transcriptionId) as Array<{ speaker_id: number; label: string }>;

        const speakerLabels: Record<number, string> = {};
        for (const label of labels) {
            speakerLabels[label.speaker_id] = label.label;
        }

        return {
            id: transcription.id,
            recordingId: transcription.recording_id,
            taskId: transcription.task_id,
            status: transcription.status,
            fullText: transcription.full_text,
            errorMessage: transcription.error_message,
            createdAt: transcription.created_at,
            completedAt: transcription.completed_at,
            segments: segments.map(s => ({
                speakerId: s.speaker_id,
                beginTime: s.begin_time,
                endTime: s.end_time,
                text: s.text,
            })),
            speakerLabels,
        };
    } catch (error) {
        console.error('❌ 获取转录详情失败:', error);
        throw error;
    }
}

/**
 * 根据录制ID获取转录
 */
export async function getTranscriptionByRecordingId(recordingId: string): Promise<{
    id: string;
    status: string;
    createdAt: number;
} | null> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        const transcription = db.prepare(`
            SELECT id, status, created_at FROM transcriptions 
            WHERE recording_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `).get(recordingId) as { id: string; status: string; created_at: number } | undefined;

        if (!transcription) {
            return null;
        }

        return {
            id: transcription.id,
            status: transcription.status,
            createdAt: transcription.created_at,
        };
    } catch (error) {
        console.error('❌ 获取转录失败:', error);
        throw error;
    }
}

/**
 * 更新说话人标签
 */
export async function updateSpeakerLabel(
    transcriptionId: string,
    speakerId: number,
    label: string
): Promise<void> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        db.prepare(`
            INSERT OR REPLACE INTO speaker_labels (transcription_id, speaker_id, label)
            VALUES (?, ?, ?)
        `).run(transcriptionId, speakerId, label);

        console.log(`📝 说话人标签已更新: ${transcriptionId}, speaker ${speakerId} -> "${label}"`);
    } catch (error) {
        console.error('❌ 更新说话人标签失败:', error);
        throw error;
    }
}

// ============ 会议级别转录合并 ============

export interface MeetingTranscriptSegment {
    userId: string;
    userName: string;
    beginTime: number;  // 相对于会议开始的毫秒数
    endTime: number;
    text: string;
}

export interface MeetingTranscript {
    meetingId: string;
    meetingTitle: string;
    startTime: number;  // 会议开始时间 (unix timestamp)
    endTime: number;    // 会议结束时间
    participants: Array<{ userId: string; userName: string }>;
    segments: MeetingTranscriptSegment[];
    fullText: string;
}

/**
 * 获取会议完整转录（合并所有单流录制）
 */
export async function getMeetingTranscription(meetingId: string): Promise<MeetingTranscript | null> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    console.log(`🔗 获取会议完整转录: ${meetingId}`);

    try {
        // 获取会议信息
        const meeting = db.prepare(`
            SELECT id, title, started_at, ended_at FROM meetings WHERE id = ?
        `).get(meetingId) as {
            id: string;
            title: string;
            started_at: number | null;
            ended_at: number | null;
        } | undefined;

        if (!meeting) {
            console.log(`   ❌ 会议不存在: ${meetingId}`);
            return null;
        }

        // 查找该会议的所有已完成录制
        const recordings = db.prepare(`
            SELECT id, user_id, user_name, cos_file_key, started_at, record_mode
            FROM recordings 
            WHERE meeting_id = ? AND status = 'completed'
            ORDER BY started_at ASC
        `).all(meetingId) as Array<{
            id: string;
            user_id: string | null;
            user_name: string | null;
            cos_file_key: string | null;
            started_at: number;
            record_mode: string | null;
        }>;

        if (recordings.length === 0) {
            console.log(`   ⚠️ 会议没有录制: ${meetingId}`);
            return null;
        }

        console.log(`   📁 找到 ${recordings.length} 个录制`);

        // 计算时间偏移基准（最早的录制开始时间）
        const baseStartTime = Math.min(...recordings.map(r => r.started_at));
        const participantsMap = new Map<string, string>();
        const mergedSegments: MeetingTranscriptSegment[] = [];

        // 获取每个录制的转录结果并合并
        for (const recording of recordings) {
            // 计算该录制相对于基准的时间偏移（毫秒）
            const timeOffset = (recording.started_at - baseStartTime) * 1000;

            // 获取用户信息
            let userId = recording.user_id || 'unknown';
            let userName = recording.user_name || userId.substring(0, 8);

            // 如果没有 user_id，尝试从文件名解析
            if (!recording.user_id && recording.cos_file_key) {
                const { parseUserIdFromFilename } = await import('../utils/cos');
                const parsedId = parseUserIdFromFilename(recording.cos_file_key);
                if (parsedId) {
                    userId = parsedId;
                    // 查找用户名
                    const user = db.prepare(`SELECT name FROM users WHERE id = ?`).get(userId) as { name: string } | undefined;
                    if (user?.name) {
                        userName = user.name;
                    } else {
                        const member = db.prepare(`SELECT user_name FROM meeting_members WHERE user_id = ? LIMIT 1`).get(userId) as { user_name: string } | undefined;
                        if (member?.user_name) {
                            userName = member.user_name;
                        } else {
                            userName = userId.substring(0, 8);
                        }
                    }
                }
            }

            // 记录参与者
            if (!participantsMap.has(userId)) {
                participantsMap.set(userId, userName);
            }

            // 获取转录记录
            const transcription = db.prepare(`
                SELECT id FROM transcriptions 
                WHERE recording_id = ? AND status = 'completed'
                ORDER BY created_at DESC LIMIT 1
            `).get(recording.id) as { id: string } | undefined;

            if (!transcription) {
                console.log(`   ⚠️ 录制 ${recording.id} 没有完成的转录`);
                continue;
            }

            // 获取转录片段
            const segments = db.prepare(`
                SELECT speaker_id, begin_time, end_time, text
                FROM transcription_segments
                WHERE transcription_id = ?
                ORDER BY begin_time ASC
            `).all(transcription.id) as Array<{
                speaker_id: number;
                begin_time: number;
                end_time: number;
                text: string;
            }>;

            // 将片段加入合并列表，应用时间偏移
            for (const seg of segments) {
                mergedSegments.push({
                    userId,
                    userName,
                    beginTime: seg.begin_time + timeOffset,
                    endTime: seg.end_time + timeOffset,
                    text: seg.text,
                });
            }

            console.log(`   ✅ ${userName}: ${segments.length} 个片段 (偏移 ${timeOffset}ms)`);
        }

        // 按时间顺序排序
        mergedSegments.sort((a, b) => a.beginTime - b.beginTime);

        console.log(`   📝 合并完成: ${mergedSegments.length} 个片段`);

        // 格式化时间辅助函数
        const formatTime = (ms: number): string => {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        // 生成完整文本
        const fullText = mergedSegments
            .map(seg => `[${formatTime(seg.beginTime)}] ${seg.userName}: ${seg.text}`)
            .join('\n');

        // 构建参与者列表
        const participants = Array.from(participantsMap.entries()).map(([userId, userName]) => ({
            userId,
            userName,
        }));

        return {
            meetingId,
            meetingTitle: meeting.title,
            startTime: meeting.started_at || baseStartTime,
            endTime: meeting.ended_at || Math.floor(Date.now() / 1000),
            participants,
            segments: mergedSegments,
            fullText,
        };
    } catch (error) {
        console.error('❌ 获取会议转录失败:', error);
        throw error;
    }
}

export default {
    submitTranscription,
    queryTranscriptionStatus,
    parseTranscriptionResult,
    createTranscriptionRecord,
    updateTranscriptionStatus,
    saveTranscriptionResult,
    getTranscriptionDetails,
    getTranscriptionByRecordingId,
    updateSpeakerLabel,
    getMeetingTranscription,
};
