// 智会转录 Worker - COS 工具

import COS from 'cos-nodejs-sdk-v5';
import { config } from '../config.js';
import { cosLogger } from '../utils/logger.js';

let cosClient: COS | null = null;

/**
 * 获取 COS 客户端
 */
function getCosClient(): COS {
    if (!cosClient) {
        cosClient = new COS({
            SecretId: config.cosSecretId,
            SecretKey: config.cosSecretKey,
        });
    }
    return cosClient;
}

/**
 * 列出指定前缀的文件
 */
export async function listFiles(prefix: string): Promise<Array<{ key: string }>> {
    const cos = getCosClient();

    return new Promise((resolve, reject) => {
        cos.getBucket({
            Bucket: config.cosBucket,
            Region: config.cosRegion,
            Prefix: prefix,
            MaxKeys: 1000,
        }, (err, data) => {
            if (err) {
                cosLogger.error({ error: err.message, prefix }, 'Failed to list COS files');
                reject(err);
                return;
            }

            const files = (data.Contents || []).map(item => ({
                key: item.Key,
            }));

            cosLogger.debug({ prefix, count: files.length }, 'Listed COS files');
            resolve(files);
        });
    });
}

/**
 * 获取文件的签名 URL
 */
export async function getFileUrl(key: string, expires: number = 3600): Promise<string> {
    const cos = getCosClient();

    return new Promise((resolve, reject) => {
        cos.getObjectUrl({
            Bucket: config.cosBucket,
            Region: config.cosRegion,
            Key: key,
            Sign: true,
            Expires: expires,
        }, (err, data) => {
            if (err) {
                cosLogger.error({ error: err.message, key }, 'Failed to generate signed URL');
                reject(err);
                return;
            }

            resolve(data.Url);
        });
    });
}

/**
 * 从文件名解析 userId
 * 格式: 20032332_1949207730__UserId_s_<base64_userId>__UserId_e_main.mp4
 */
export function parseUserIdFromFilename(filename: string): string | null {
    const match = filename.match(/__UserId_s_([A-Za-z0-9+/=]+)__UserId_e_/);
    if (match && match[1]) {
        try {
            return Buffer.from(match[1], 'base64').toString('utf-8');
        } catch {
            return null;
        }
    }
    return null;
}
