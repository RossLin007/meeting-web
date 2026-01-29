// 智会后端 - 云录制服务 (基于官方 API 文档)

import * as tencentcloud from 'tencentcloud-sdk-nodejs-trtc';

const TrtcClient = tencentcloud.trtc.v20190722.Client;

// 打印配置信息（调试用）
console.log('Loading TRTC config:', {
    secretIdPrefix: (process.env.TENCENT_SECRET_ID || '').substring(0, 8) + '...',
    hasSecretKey: !!(process.env.TENCENT_SECRET_KEY),
    region: 'ap-singapore',
});

// 配置 - 使用国际站 API
const config = {
    credential: {
        secretId: process.env.TENCENT_SECRET_ID || '',
        secretKey: process.env.TENCENT_SECRET_KEY || '',
    },
    region: 'ap-singapore',  // 国际站必须使用新加坡区域作为接入点
    // region: 'ap-hongkong',      // 国际站区域 (User Request)
    profile: {
        httpProfile: {
            endpoint: 'trtc.intl.tencentcloudapi.com',  // 国际站 API 端点
            // endpoint: 'trtc.tencentcloudapi.com',           // 通用 API 端点
        },
    },
};

// 创建客户端
const client = new TrtcClient(config);

// COS 配置
const cosConfig = {
    Vendor: 2, // 腾讯云 COS
    Region: process.env.COS_REGION || 'ap-hongkong',
    Bucket: process.env.COS_BUCKET || 'xiaofan-1395107881',
};

// 录制任务存储（生产环境应使用 Redis 等）
const recordingTasks = new Map<string, {
    taskId: string;
    roomId: number;
    startTime: number;
}>();

interface StartRecordingParams {
    sdkAppId: number;
    roomId: number;
    recordUserId: string;  // 录制机器人用户 ID
    userSig: string;
    useMixStream?: boolean;  // 是否使用混流录制（多人时使用）
    subscribeUserIds?: string[];  // 要订阅的用户 ID 列表
}

interface RecordingResult {
    success: boolean;
    taskId?: string;
    error?: string;
}

/**
 * 启动云录制
 * 
 * 参考文档: https://trtc.io/zh/document/46960
 * 
 * 关键参数:
 * - RecordMode: 2 = 混流录制 (录制所有人混合后的音视频)
 * - StreamType: 0 = 音视频, 1 = 仅音频, 2 = 仅视频
 * - RoomIdType: 0 = 整型房间号, 1 = 字符串房间号
 */
export async function startCloudRecording(params: StartRecordingParams): Promise<RecordingResult> {
    const { sdkAppId, roomId, recordUserId, userSig, useMixStream = true, subscribeUserIds } = params;

    // 验证凭证
    const secretId = process.env.TENCENT_SECRET_ID || '';
    const secretKey = process.env.TENCENT_SECRET_KEY || '';
    const cosBucket = process.env.COS_BUCKET || 'xiaofan-1395107881';
    const cosRegion = process.env.COS_REGION || 'ap-hongkong';

    console.log('========================================');
    console.log('🎬 开始云录制 - 调试信息');
    console.log('========================================');
    console.log('📌 凭证验证:');
    console.log(`   - SecretId: ${secretId ? secretId.substring(0, 12) + '...(已配置)' : '❌ 未配置'}`);
    console.log(`   - SecretKey: ${secretKey ? '已配置 (' + secretKey.length + ' chars)' : '❌ 未配置'}`);
    console.log(`   - COS Bucket: ${cosBucket}`);
    console.log(`   - COS Region: ${cosRegion}`);

    if (!secretId || !secretKey) {
        console.error('❌ 凭证未配置！请检查环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
        return {
            success: false,
            error: 'Missing TENCENT_SECRET_ID or TENCENT_SECRET_KEY in environment',
        };
    }

    // 根据人数决定录制模式
    // 1=单流录制, 2=混流录制（九宫格）
    const recordMode: 1 | 2 = useMixStream ? 2 : 1;

    try {
        // 判断房间号类型：纯数字用整型(1)，否则用字符串(0)
        const isNumericRoomId = /^\d+$/.test(String(roomId));
        const roomIdType = isNumericRoomId ? 1 : 0;

        console.log(`📍 房间号分析:`);
        console.log(`   - RoomId: ${roomId}`);
        console.log(`   - 类型: ${isNumericRoomId ? '整型(1)' : '字符串(0)'}`);

        const request: any = {
            // 基础参数
            SdkAppId: sdkAppId,
            RoomId: String(roomId),  // API 统一用字符串传递
            RoomIdType: roomIdType,  // 0=字符串, 1=整型
            UserId: recordUserId,
            UserSig: userSig,

            // 录制参数
            RecordParams: {
                RecordMode: recordMode,   // 1=单流, 2=混流
                MaxIdleTime: 60,          // 最大空闲时间 60 秒
                StreamType: 0,            // 0=音视频, 1=仅音频, 2=仅视频
                OutputFormat: 1,          // 0：HLS 1：HLS + MP4 2：HLS + FLV 3：MP4 4：FLV
            },

            // 存储参数 - 腾讯云 COS
            StorageParams: {
                CloudStorage: {
                    Vendor: 0,          // 0=腾讯云 COS
                    Region: cosRegion,
                    Bucket: cosBucket,
                    AccessKey: secretId,
                    SecretKey: secretKey,
                    FileNamePrefix: [`meeting`, `room_${roomId}`],
                },
            },
        };

        // 只有混流模式才添加混流参数
        if (recordMode === 2) {
            request.MixTranscodeParams = {
                VideoParams: {
                    Width: 640,
                    Height: 480,
                    Fps: 15,
                    BitRate: 600000,
                    Gop: 10,
                },
            };
            request.MixLayoutParams = {
                MixLayoutMode: 3,         // 3=九宫格布局
            };
        }

        console.log('📤 录制请求参数:');
        console.log(JSON.stringify({
            SdkAppId: request.SdkAppId,
            RoomId: request.RoomId,
            RoomIdType: request.RoomIdType,
            UserId: request.UserId,
            UserSig: request.UserSig.substring(0, 30) + '...',
            RecordParams: request.RecordParams,
            MixTranscodeParams: request.MixTranscodeParams,
            MixLayoutParams: request.MixLayoutParams,
            StorageParams: {
                CloudStorage: {
                    ...request.StorageParams.CloudStorage,
                    AccessKey: request.StorageParams.CloudStorage.AccessKey.substring(0, 8) + '...',
                    SecretKey: '***hidden***',
                }
            }
        }, null, 2));

        console.log('');
        console.log('🚀 正在调用腾讯云 CreateCloudRecording API...');
        console.log(`   API Endpoint: trtc.intl.tencentcloudapi.com`);

        const startTime = Date.now();
        const response = await client.CreateCloudRecording(request);
        const duration = Date.now() - startTime;

        const taskId = response.TaskId || '';

        // 存储任务信息
        recordingTasks.set(String(roomId), {
            taskId,
            roomId,
            startTime: Date.now(),
        });

        console.log('');
        console.log('✅ 云录制启动成功!');
        console.log(`   - TaskId: ${taskId}`);
        console.log(`   - RoomId: ${roomId}`);
        console.log(`   - RequestId: ${response.RequestId}`);
        console.log(`   - 耗时: ${duration}ms`);
        console.log('========================================');

        // 如果指定了订阅用户，无论是单流还是混流，都进行显式订阅
        if (taskId && subscribeUserIds && subscribeUserIds.length > 0) {
            await updateRecordingSubscribers({
                sdkAppId,
                taskId,
                subscribeUserIds,
            });
        }
        console.log('========================================');

        return {
            success: true,
            taskId,
        };
    } catch (error: any) {
        console.log('');
        console.error('❌ 云录制启动失败!');
        console.error('========================================');
        console.error('错误详情:');
        console.error(`   - Code: ${error.code || 'N/A'}`);
        console.error(`   - Message: ${error.message || 'Unknown error'}`);
        console.error(`   - RequestId: ${error.requestId || 'N/A'}`);

        // 打印完整错误对象用于调试
        console.error('完整错误对象:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error('========================================');

        const errorMessage = error.message || 'Unknown error';
        const errorCode = error.code || '';

        return {
            success: false,
            error: `${errorCode}: ${errorMessage}`,
        };
    }
}

interface StopRecordingParams {
    sdkAppId: number;
    roomId: number;
}

/**
 * 停止云录制
 * 
 * 参考文档: https://trtc.io/zh/document/46962
 */
export async function stopCloudRecording(params: StopRecordingParams): Promise<RecordingResult> {
    const { sdkAppId, roomId } = params;

    // 获取任务信息
    const task = recordingTasks.get(String(roomId));

    if (!task) {
        return {
            success: false,
            error: 'Recording task not found',
        };
    }

    try {
        const request = {
            SdkAppId: sdkAppId,
            TaskId: task.taskId,
        };

        console.log('Stopping cloud recording:', {
            taskId: task.taskId,
            roomId,
            duration: Math.floor((Date.now() - task.startTime) / 1000) + 's',
        });

        await client.DeleteCloudRecording(request);

        // 清除任务
        recordingTasks.delete(String(roomId));

        console.log('Cloud recording stopped successfully:', {
            taskId: task.taskId,
            roomId,
        });

        // 调用 DescribeCloudRecording 查询最终状态（调试用）
        console.log('========================================');
        console.log('🔍 录制停止后查询状态 (DescribeCloudRecording)...');
        try {
            const describeRequest = {
                SdkAppId: sdkAppId,
                TaskId: task.taskId,
            };
            const describeResponse = await client.DescribeCloudRecording(describeRequest);
            console.log('📋 录制最终状态:', JSON.stringify(describeResponse, null, 2));
        } catch (describeError: any) {
            console.log('⚠️ DescribeCloudRecording 查询结果:');
            console.log('   - Code:', describeError.code || 'Unknown');
            console.log('   - Message:', describeError.message || 'Unknown error');
            console.log('   - RequestId:', describeError.requestId || 'N/A');
            // 如果是 ResourceNotFound，说明任务已结束并被清理
            if (describeError.code === 'ResourceNotFound') {
                console.log('   ℹ️ 任务已完成并被 TRTC 清理，这是正常行为');
            }
        }
        console.log('========================================');

        return {
            success: true,
            taskId: task.taskId,
        };
    } catch (error: any) {
        console.error('Failed to stop cloud recording:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

export async function updateRecordingSubscribers(params: {
    sdkAppId: number;
    taskId: string;
    subscribeUserIds: string[];
}): Promise<void> {
    const { sdkAppId, taskId, subscribeUserIds } = params;
    if (!taskId || subscribeUserIds.length === 0) return;

    try {
        console.log(`📡 正在更新订阅名单 (ModifyCloudRecording)...`);
        console.log(`   👥 订阅用户: ${subscribeUserIds.join(', ')}`);

        const modifyRequest = {
            SdkAppId: sdkAppId,
            TaskId: taskId,
            SubscribeStreamUserIds: {
                SubscribeAudioUserIds: subscribeUserIds,
                SubscribeVideoUserIds: subscribeUserIds,
            },
        };

        await client.ModifyCloudRecording(modifyRequest);
        console.log('✅ 订阅更新成功');
    } catch (modifyError: any) {
        console.error('⚠️ 订阅更新失败 (非致命):', modifyError.message);
    }
}

/**
 * 获取录制状态（从内存缓存）
 */
export async function getRecordingStatus(sdkAppId: number, roomId: number): Promise<{
    isRecording: boolean;
    taskId?: string;
    duration?: number;
}> {
    const task = recordingTasks.get(String(roomId));

    if (!task) {
        return { isRecording: false };
    }

    return {
        isRecording: true,
        taskId: task.taskId,
        duration: Math.floor((Date.now() - task.startTime) / 1000),
    };
}

/**
 * 调用 TRTC API 查询录制任务状态
 * 注意：只能查询正在进行的录制任务
 */
export async function describeCloudRecording(sdkAppId: number, taskId: string): Promise<{
    success: boolean;
    status?: string;
    fileList?: Array<{ fileName: string; trackType: string; beginTime: number }>;
    error?: string;
}> {
    try {
        console.log('🔍 查询录制任务状态:', { sdkAppId, taskId });

        const request = {
            SdkAppId: sdkAppId,
            TaskId: taskId,
        };

        const response = await client.DescribeCloudRecording(request);

        console.log('📋 录制任务状态:', JSON.stringify(response, null, 2));

        return {
            success: true,
            status: response.Status,
            fileList: response.StorageFileList?.map((f: { FileName?: string; TrackType?: string; BeginTimeStamp?: number }) => ({
                fileName: f.FileName || '',
                trackType: f.TrackType || '',
                beginTime: f.BeginTimeStamp || 0,
            })),
        };
    } catch (error: any) {
        console.error('❌ 查询录制任务失败:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * 保存录制记录到数据库
 */
export async function saveRecordingToDB(params: {
    id: string;
    meetingId: string;
    taskId: string;
    startedBy: string;
    title?: string;
    recordMode?: 'mixed' | 'single';
    userId?: string;
    userName?: string;
    parentId?: string;
}): Promise<void> {
    // 延迟导入避免循环依赖
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        const stmt = db.prepare(`
            INSERT INTO recordings (id, meeting_id, task_id, started_by, title, started_at, status, visibility, record_mode, user_id, user_name, parent_id)
            VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'), 'recording', 'host_only', ?, ?, ?, ?)
        `);
        stmt.run(
            params.id,
            params.meetingId,
            params.taskId,
            params.startedBy,
            params.title || '会议录制',
            params.recordMode || 'mixed',
            params.userId || null,
            params.userName || null,
            params.parentId || null
        );
        console.log('💾 录制记录已保存到数据库:', params.id, params.parentId ? `(子录制: ${params.userName})` : '');
    } catch (error) {
        console.error('❌ 保存录制记录失败:', error);
    }
}

/**
 * 更新录制记录（停止录制时）
 */
export async function updateRecordingInDB(params: {
    taskId: string;
    status: 'completed' | 'failed';
    duration?: number;
    fileUrl?: string;
    fileSize?: number;
    cosFileKey?: string;
}): Promise<void> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        const stmt = db.prepare(`
            UPDATE recordings 
            SET status = ?, 
                ended_at = strftime('%s', 'now'),
                duration = ?,
                file_url = ?,
                file_size = ?,
                cos_file_key = ?
            WHERE task_id = ?
        `);
        stmt.run(
            params.status,
            params.duration || null,
            params.fileUrl || null,
            params.fileSize || null,
            params.cosFileKey || null,
            params.taskId
        );
        console.log('💾 录制记录已更新:', params.taskId);
    } catch (error) {
        console.error('❌ 更新录制记录失败:', error);
    }
}

/**
 * 获取会议的录制列表
 */
export async function getRecordingsByMeeting(meetingId: string, userId: string, isHost: boolean): Promise<Array<{
    id: string;
    taskId: string;
    startedBy: string;
    startedAt: number;
    endedAt: number | null;
    duration: number | null;
    status: string;
    visibility: string;
    fileUrl: string | null;
    title: string | null;
    cosFileKey?: string;
}>> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        // 主持人可以看到所有录制，其他人只能看到公开的
        const query = isHost
            ? `SELECT * FROM recordings WHERE meeting_id = ? ORDER BY started_at DESC`
            : `SELECT * FROM recordings WHERE meeting_id = ? AND visibility = 'all' ORDER BY started_at DESC`;

        const recordings = db.prepare(query).all(meetingId) as Array<{
            id: string;
            task_id: string;
            started_by: string;
            started_at: number;
            ended_at: number | null;
            duration: number | null;
            status: string;
            visibility: string;
            file_url: string | null;
            title: string | null;
            cos_file_key?: string;
        }>;

        return recordings.map(r => ({
            id: r.id,
            taskId: r.task_id,
            startedBy: r.started_by,
            startedAt: r.started_at,
            endedAt: r.ended_at,
            duration: r.duration,
            status: r.status,
            visibility: r.visibility,
            fileUrl: r.file_url,
            title: r.title,
            cosFileKey: r.cos_file_key,
        }));
    } catch (error) {
        console.error('❌ 获取录制列表失败:', error);
        return [];
    }
}

/**
 * 更新录制可见性
 */
export async function updateRecordingVisibility(
    recordingId: string,
    visibility: 'host_only' | 'all',
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const { getDatabase } = await import('../db');
    const db = getDatabase();

    try {
        // 验证用户是否是录制所属会议的主持人
        const recording = db.prepare(`
            SELECT r.*, m.host_id 
            FROM recordings r 
            JOIN meetings m ON r.meeting_id = m.id 
            WHERE r.id = ?
        `).get(recordingId) as { host_id: string } | undefined;

        if (!recording) {
            return { success: false, error: 'Recording not found' };
        }

        if (recording.host_id !== userId) {
            return { success: false, error: 'Only host can change recording visibility' };
        }

        db.prepare(`UPDATE recordings SET visibility = ? WHERE id = ?`).run(visibility, recordingId);

        console.log(`📝 录制可见性已更新: ${recordingId} -> ${visibility}`);
        return { success: true };
    } catch (error: any) {
        console.error('❌ 更新录制可见性失败:', error);
        return { success: false, error: error.message };
    }
}

export default {
    startCloudRecording,
    stopCloudRecording,
    getRecordingStatus,
    describeCloudRecording,
    saveRecordingToDB,
    updateRecordingInDB,
    getRecordingsByMeeting,
    updateRecordingVisibility,
    updateRecordingSubscribers,
};
