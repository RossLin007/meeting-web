// 智会转录 Worker - 阿里云 ASR 服务 (DashScope paraformer-v2)

import { asrLogger } from '../utils/logger.js';
import { config } from '../config.js';

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
    speakerIds: number[];
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface TranscriptionTaskResult {
    taskId: string;
    status: TaskStatus;
    results?: Array<{
        fileUrl: string;
        transcriptionUrl: string;
        subtaskStatus: string;
    }>;
    error?: string;
}

/**
 * 提交转录任务到阿里云
 */
export async function submitTranscription(
    fileUrl: string,
    speakerCount?: number
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    if (!config.dashscopeApiKey) {
        asrLogger.error('DASHSCOPE_API_KEY not configured');
        return { success: false, error: 'DASHSCOPE_API_KEY not configured' };
    }

    asrLogger.info({ fileUrl: fileUrl.substring(0, 80) + '...' }, 'Submitting transcription task');

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
                diarization_enabled: true,
            },
        };

        if (speakerCount && speakerCount >= 2 && speakerCount <= 100) {
            requestBody.parameters.speaker_count = speakerCount;
        }

        const response = await fetch(TRANSCRIPTION_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.dashscopeApiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify(requestBody),
        });

        const result = await response.json() as {
            message?: string;
            output?: { task_id?: string; task_status?: string }
        };

        if (!response.ok) {
            asrLogger.error({ result }, 'Failed to submit transcription task');
            return {
                success: false,
                error: result.message || `HTTP ${response.status}`,
            };
        }

        const taskId = result.output?.task_id;
        asrLogger.info({ taskId, status: result.output?.task_status }, 'Transcription task submitted');

        return { success: true, taskId };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        asrLogger.error({ error: errorMessage }, 'Exception submitting transcription');
        return { success: false, error: errorMessage };
    }
}

/**
 * 查询转录任务状态
 */
export async function queryTranscriptionStatus(taskId: string): Promise<TranscriptionTaskResult> {
    if (!config.dashscopeApiKey) {
        return { taskId, status: 'FAILED', error: 'DASHSCOPE_API_KEY not configured' };
    }

    asrLogger.debug({ taskId }, 'Querying transcription status');

    try {
        const response = await fetch(`${TASK_STATUS_API_URL}/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.dashscopeApiKey}`,
            },
        });

        const result = await response.json() as {
            message?: string;
            code?: string;
            output?: {
                task_status?: string;
                message?: string;
                code?: string;
                results?: Array<{
                    file_url: string;
                    transcription_url: string;
                    subtask_status: string;
                    message?: string
                }>;
            };
        };

        if (!response.ok) {
            asrLogger.error({ result }, 'Failed to query transcription status');
            return {
                taskId,
                status: 'FAILED',
                error: result.message || `HTTP ${response.status}`,
            };
        }

        const output = result.output || {};
        const status = output.task_status as TaskStatus;

        if (status === 'FAILED') {
            asrLogger.error({
                code: output.code || result.code,
                message: output.message || result.message
            }, 'Transcription task failed');
        }

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
            results: output.results?.map(r => ({
                fileUrl: r.file_url,
                transcriptionUrl: r.transcription_url,
                subtaskStatus: r.subtask_status,
            })),
            error: errorMessage,
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        asrLogger.error({ error: errorMessage }, 'Exception querying transcription status');
        return { taskId, status: 'FAILED', error: errorMessage };
    }
}

/**
 * 下载并解析转录结果
 */
export async function parseTranscriptionResult(transcriptionUrl: string): Promise<ParsedTranscript> {
    asrLogger.info({ url: transcriptionUrl.substring(0, 80) + '...' }, 'Downloading transcription result');

    try {
        const response = await fetch(transcriptionUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as {
            transcripts?: Array<{
                text?: string;
                sentences?: Array<{
                    speaker_id?: number;
                    begin_time?: number;
                    end_time?: number;
                    text?: string
                }>
            }>
        };

        const transcripts = data.transcripts || [];
        const segments: TranscriptionSegment[] = [];
        const speakerIdSet = new Set<number>();
        let fullText = '';

        for (const transcript of transcripts) {
            if (transcript.text) {
                fullText += transcript.text + '\n';
            }

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

        asrLogger.info({
            segments: segments.length,
            speakers: speakerIdSet.size
        }, 'Transcription result parsed');

        return {
            fullText: fullText.trim(),
            segments,
            speakerIds: Array.from(speakerIdSet).sort((a, b) => a - b),
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        asrLogger.error({ error: errorMessage }, 'Failed to parse transcription result');
        throw new Error(`Failed to parse transcription result: ${errorMessage}`);
    }
}
