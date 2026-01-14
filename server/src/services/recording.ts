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
    region: 'ap-singapore',  // 国际站区域
    profile: {
        httpProfile: {
            endpoint: 'trtc.intl.tencentcloudapi.com',  // 国际站 API 端点
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
    const { sdkAppId, roomId, recordUserId, userSig, useMixStream = true } = params;

    // 始终使用混流录制（2），无论人数多少
    // 单流录制（1）会为每个用户生成独立文件
    const recordMode = 2;  // 强制混流录制

    try {
        const request = {
            // 基础参数
            SdkAppId: sdkAppId,
            RoomId: String(roomId),
            RoomIdType: 0,  // 整型房间号
            UserId: recordUserId,
            UserSig: userSig,

            // 录制参数
            RecordParams: {
                RecordMode: recordMode,   // 2=混流录制
                MaxIdleTime: 60,          // 最大空闲时间 60 秒
                StreamType: 0,            // 0=音视频, 1=仅音频, 2=仅视频
            },

            // 混流转码参数 (混流模式必须)
            // 优化文件大小：使用较低码率，会议场景足够清晰
            MixTranscodeParams: {
                VideoParams: {
                    Width: 640,           // 标清分辨率
                    Height: 360,
                    Fps: 15,              // 帧率（会议足够）
                    BitRate: 500000,      // 码率 500Kbps（约 225MB/小时）
                    Gop: 3,               // 关键帧间隔（秒）
                },
                // 音频使用默认配置
            },

            // 混流布局参数
            MixLayoutParams: {
                MixLayoutMode: 3,         // 3=自适应布局 (九宫格)
                // MaxVideoUser: 9,       // 最大视频用户数（可选）
            },

            // 存储参数 - 腾讯云 COS
            StorageParams: {
                CloudStorage: {
                    Vendor: 0,          // 0=腾讯云 COS
                    Region: process.env.COS_REGION || 'ap-hongkong',
                    Bucket: process.env.COS_BUCKET || 'xiaofan-1395107881',
                    AccessKey: process.env.TENCENT_SECRET_ID || '',
                    SecretKey: process.env.TENCENT_SECRET_KEY || '',
                    FileNamePrefix: [`meeting`, String(roomId)],
                },
            },
        };

        console.log('Starting cloud recording with params:', JSON.stringify({
            sdkAppId,
            roomId,
            recordUserId,
            recordMode: 'MixedStream (合流录制)',
            videoResolution: '1280x720',
            storageRegion: request.StorageParams.CloudStorage.Region,
            storageBucket: request.StorageParams.CloudStorage.Bucket,
        }, null, 2));

        const response = await client.CreateCloudRecording(request);

        const taskId = response.TaskId || '';

        // 存储任务信息
        recordingTasks.set(String(roomId), {
            taskId,
            roomId,
            startTime: Date.now(),
        });

        console.log('Cloud recording started successfully:', {
            taskId,
            roomId,
            requestId: response.RequestId,
        });

        return {
            success: true,
            taskId,
        };
    } catch (error: any) {
        console.error('Failed to start cloud recording:', error);

        // 详细错误信息
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

/**
 * 获取录制状态
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

export default {
    startCloudRecording,
    stopCloudRecording,
    getRecordingStatus,
};
