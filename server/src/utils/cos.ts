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

export default {
    getFileUrl,
    checkFileExists,
};
