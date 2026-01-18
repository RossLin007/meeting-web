// 智会后端 - 腾讯云 COS 工具类
import COS from 'cos-nodejs-sdk-v5';

// 验证环境变量
if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.warn('⚠️ COS 工具类初始化警告: 未找到 TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY');
}

const cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID || '',
    SecretKey: process.env.TENCENT_SECRET_KEY || '',
});

const BUCKET = process.env.COS_BUCKET || 'xiaofan-1395107881';
const REGION = process.env.COS_REGION || 'ap-hongkong';

/**
 * 获取文件的临时访问 URL (带签名)
 * @param key 文件路径 (Key)
 * @param expiresIn 有效期 (秒)，默认 1 小时
 */
export async function getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return new Promise((resolve, reject) => {
        // 确保 key 不以 / 开头 (COS SDK 要求)
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;

        cos.getObjectUrl({
            Bucket: BUCKET,
            Region: REGION,
            Key: cleanKey,
            Sign: true, // 生成签名链接
            Expires: expiresIn,
        }, (err, data) => {
            if (err || !data) {
                console.error('❌ 获取 COS 文件 URL 失败:', err);
                reject(err);
            } else {
                resolve(data.Url);
            }
        });
    });
}

/**
 * 检查文件是否存在
 */
export async function checkFileExists(key: string): Promise<boolean> {
    return new Promise((resolve) => {
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;

        cos.headObject({
            Bucket: BUCKET,
            Region: REGION,
            Key: cleanKey,
        }, (err, data) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * 从单流录制文件名中解析 userId
 * 文件名格式: {sdkAppId}_{roomId}__UserId_s_{base64UserId}__UserId_e_main.mp4
 * 
 * @param fileName 文件名或完整路径
 * @returns 解码后的 userId，如果解析失败返回 null
 */
export function parseUserIdFromFilename(fileName: string): string | null {
    try {
        // 提取文件名部分
        const baseName = fileName.includes('/') ? fileName.split('/').pop() || fileName : fileName;

        // 匹配 __UserId_s_{base64}__UserId_e_ 模式
        const match = baseName.match(/__UserId_s_([A-Za-z0-9+/=]+)__UserId_e_/);

        if (!match || !match[1]) {
            return null;
        }

        // Base64 解码
        const base64UserId = match[1];
        const userId = Buffer.from(base64UserId, 'base64').toString('utf-8');

        return userId;
    } catch (error) {
        console.error('解析文件名中的 userId 失败:', error);
        return null;
    }
}

/**
 * 判断文件是否为单流录制文件（包含 userId）
 */
export function isSingleStreamFile(fileName: string): boolean {
    return fileName.includes('__UserId_s_') && fileName.includes('__UserId_e_');
}

export default {
    getFileUrl,
    checkFileExists,
    parseUserIdFromFilename,
    isSingleStreamFile,
};
