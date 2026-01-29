// 智会后端 - m3u8 解析工具
// 从 COS 下载 m3u8 文件并解析 TRTC 精确时间戳

import { getFileUrl, getFileContent } from './cos';

/**
 * m3u8 文件中的 TRTC 扩展信息
 */
export interface M3u8TRTCInfo {
    startRecTime: number;      // 录制开始时间（毫秒时间戳）
    userId: string | null;     // 用户ID
    mediaId: string | null;    // 媒体ID（main/aux）
    streamType: number | null; // 0=音频, 1=视频
    isMixStream: boolean;      // 是否混流
}

/**
 * 从 m3u8 内容解析 TRTC 扩展信息
 * 
 * @param content m3u8 文件内容
 * @returns TRTC 扩展信息
 */
export function parseM3u8Content(content: string): M3u8TRTCInfo {
    const result: M3u8TRTCInfo = {
        startRecTime: 0,
        userId: null,
        mediaId: null,
        streamType: null,
        isMixStream: false,
    };

    // 解析 #EXT-X-TRTC-START-REC-TIME:1768908622488
    const startTimeMatch = content.match(/#EXT-X-TRTC-START-REC-TIME:(\d+)/);
    if (startTimeMatch) {
        result.startRecTime = parseInt(startTimeMatch[1], 10);
    }

    // 解析 #EXT-X-TRTC-USER-ID:c756dbf7-4c2a-435a-b19b-0e60eefdc723
    const userIdMatch = content.match(/#EXT-X-TRTC-USER-ID:(.+)/);
    if (userIdMatch) {
        result.userId = userIdMatch[1].trim();
    }

    // 解析 #EXT-X-TRTC-MEDIA-ID:main
    const mediaIdMatch = content.match(/#EXT-X-TRTC-MEDIA-ID:(.+)/);
    if (mediaIdMatch) {
        result.mediaId = mediaIdMatch[1].trim();
    }

    // 解析 #EXT-X-TRTC-STREAM-TYPE:0 (0=音频, 1=视频)
    const streamTypeMatch = content.match(/#EXT-X-TRTC-STREAM-TYPE:(\d+)/);
    if (streamTypeMatch) {
        result.streamType = parseInt(streamTypeMatch[1], 10);
    }

    // 解析 #EXT-X-TRTC-MIX-STREAM:0 (0=单流, 1=混流)
    const mixStreamMatch = content.match(/#EXT-X-TRTC-MIX-STREAM:(\d+)/);
    if (mixStreamMatch) {
        result.isMixStream = mixStreamMatch[1] === '1';
    }

    return result;
}

/**
 * 从 COS 获取 m3u8 文件并解析精确的录制开始时间
 * 
 * @param cosKey COS 文件路径
 * @returns 录制开始时间（毫秒时间戳），如果失败返回 0
 */
export async function getM3u8StartTime(cosKey: string): Promise<number> {
    try {
        // 如果是 .mp4 文件，尝试找对应的 .m3u8
        let m3u8Key = cosKey;
        if (cosKey.endsWith('.mp4')) {
            // 尝试找 _audio.m3u8 或 _video.m3u8
            m3u8Key = cosKey.replace('.mp4', '_audio.m3u8');
        }

        console.log(`📥 解析 m3u8 时间戳: ${m3u8Key}`);

        // 获取文件内容
        const content = await getFileContent(m3u8Key);
        if (!content) {
            console.warn(`⚠️ 无法获取 m3u8 内容: ${m3u8Key}`);
            return 0;
        }

        const info = parseM3u8Content(content);
        console.log(`   ✅ START-REC-TIME: ${info.startRecTime}`);
        console.log(`   📌 USER-ID: ${info.userId || 'N/A'}`);

        return info.startRecTime;
    } catch (error) {
        console.error(`❌ 解析 m3u8 失败: ${cosKey}`, error);
        return 0;
    }
}

/**
 * 批量获取多个录制的精确开始时间
 * 
 * @param recordings 录制记录数组（需要包含 cos_file_key）
 * @returns 录制ID到开始时间的映射
 */
export async function batchGetRecordingStartTimes(
    recordings: Array<{ id: string; cos_file_key: string | null }>
): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    await Promise.all(
        recordings.map(async (recording) => {
            if (recording.cos_file_key) {
                const startTime = await getM3u8StartTime(recording.cos_file_key);
                result.set(recording.id, startTime);
            } else {
                result.set(recording.id, 0);
            }
        })
    );

    return result;
}

export default {
    parseM3u8Content,
    getM3u8StartTime,
    batchGetRecordingStartTimes,
};
