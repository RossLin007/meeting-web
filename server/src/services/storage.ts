// 智会后端 - COS 存储服务
import COS from 'cos-nodejs-sdk-v5';

const BUCKET = process.env.COS_BUCKET || 'xiaofan-1395107881';
const REGION = process.env.COS_REGION || 'ap-hongkong';
const STORAGE_LIMIT_GB = 100; // 存储上限 (GB)

const cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID || '',
    SecretKey: process.env.TENCENT_SECRET_KEY || '',
});

export interface FileInfo {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    url?: string;
}

export interface StorageStats {
    usedBytes: number;
    usedGB: string;
    totalGB: number;
    fileCount: number;
    usagePercent: number;
}

/**
 * 获取存储统计信息
 */
export async function getStorageStats(prefix: string = 'meeting/'): Promise<StorageStats> {
    return new Promise((resolve, reject) => {
        let totalSize = 0;
        let fileCount = 0;
        let marker = '';

        const listAll = () => {
            cos.getBucket({
                Bucket: BUCKET,
                Region: REGION,
                Prefix: prefix,
                Marker: marker,
                MaxKeys: 1000,
            }, (err, data) => {
                if (err) {
                    console.error('❌ 获取 COS 文件列表失败:', err);
                    return reject(err);
                }

                // 累计文件大小和数量
                for (const item of data.Contents || []) {
                    totalSize += parseInt(item.Size || '0', 10);
                    fileCount++;
                }

                // 检查是否还有更多
                if (data.IsTruncated === 'true' && data.NextMarker) {
                    marker = data.NextMarker;
                    listAll();
                } else {
                    const usedGB = totalSize / (1024 * 1024 * 1024);
                    resolve({
                        usedBytes: totalSize,
                        usedGB: usedGB.toFixed(2),
                        totalGB: STORAGE_LIMIT_GB,
                        fileCount,
                        usagePercent: Math.min((usedGB / STORAGE_LIMIT_GB) * 100, 100),
                    });
                }
            });
        };

        listAll();
    });
}

/**
 * 列出所有录制文件
 */
export async function listFiles(prefix: string = 'meeting/'): Promise<FileInfo[]> {
    return new Promise((resolve, reject) => {
        const files: FileInfo[] = [];
        let marker = '';

        const listAll = () => {
            cos.getBucket({
                Bucket: BUCKET,
                Region: REGION,
                Prefix: prefix,
                Marker: marker,
                MaxKeys: 1000,
            }, (err, data) => {
                if (err) {
                    console.error('❌ 获取 COS 文件列表失败:', err);
                    return reject(err);
                }

                for (const item of data.Contents || []) {
                    // 过滤掉目录（以 / 结尾且大小为 0）
                    if (item.Key?.endsWith('/') && item.Size === '0') continue;
                    // 只显示视频文件 (.m3u8, .ts, .mp4, .flv)
                    const ext = item.Key?.split('.').pop()?.toLowerCase();
                    if (!['m3u8', 'ts', 'mp4', 'flv', 'webm'].includes(ext || '')) continue;

                    files.push({
                        key: item.Key || '',
                        name: item.Key?.split('/').pop() || '',
                        size: parseInt(item.Size || '0', 10),
                        lastModified: item.LastModified || '',
                    });
                }

                if (data.IsTruncated === 'true' && data.NextMarker) {
                    marker = data.NextMarker;
                    listAll();
                } else {
                    // 按时间倒序
                    files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
                    resolve(files);
                }
            });
        };

        listAll();
    });
}

/**
 * 获取文件的签名 URL
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return new Promise((resolve, reject) => {
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;
        cos.getObjectUrl({
            Bucket: BUCKET,
            Region: REGION,
            Key: cleanKey,
            Sign: true,
            Expires: expiresIn,
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.Url);
            }
        });
    });
}

/**
 * 删除文件
 */
export async function deleteFile(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;
        cos.deleteObject({
            Bucket: BUCKET,
            Region: REGION,
            Key: cleanKey,
        }, (err) => {
            if (err) {
                console.error('❌ 删除文件失败:', err);
                reject(err);
            } else {
                console.log(`✅ 已删除文件: ${cleanKey}`);
                resolve(true);
            }
        });
    });
}

/**
 * 重命名文件 (COS 不支持直接重命名，需要 copy + delete)
 */
export async function renameFile(oldKey: string, newName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const cleanOldKey = oldKey.startsWith('/') ? oldKey.slice(1) : oldKey;
        const pathParts = cleanOldKey.split('/');
        pathParts[pathParts.length - 1] = newName;
        const newKey = pathParts.join('/');

        // Step 1: Copy to new key
        cos.putObjectCopy({
            Bucket: BUCKET,
            Region: REGION,
            Key: newKey,
            CopySource: `${BUCKET}.cos.${REGION}.myqcloud.com/${encodeURIComponent(cleanOldKey)}`,
        }, (copyErr) => {
            if (copyErr) {
                console.error('❌ 复制文件失败:', copyErr);
                return reject(copyErr);
            }

            // Step 2: Delete old key
            cos.deleteObject({
                Bucket: BUCKET,
                Region: REGION,
                Key: cleanOldKey,
            }, (delErr) => {
                if (delErr) {
                    console.error('⚠️ 删除旧文件失败:', delErr);
                    // 不阻止返回，因为复制已成功
                }
                console.log(`✅ 已重命名: ${cleanOldKey} -> ${newKey}`);
                resolve(newKey);
            });
        });
    });
}

export default {
    getStorageStats,
    listFiles,
    getSignedUrl,
    deleteFile,
    renameFile,
};
