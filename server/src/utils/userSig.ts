// 智会后端 - UserSig 生成器

import TLSSigAPIv2 from 'tls-sig-api-v2';

const SDK_APP_ID = Number(process.env.TRTC_SDK_APP_ID) || 20032332;
const SECRET_KEY = process.env.TRTC_SECRET_KEY || '';

// 默认过期时间 24 小时
const DEFAULT_EXPIRE = 86400;

/**
 * 生成 UserSig
 * @param userId 用户 ID
 * @param expire 过期时间（秒）
 */
export function generateUserSig(userId: string, expire: number = DEFAULT_EXPIRE): string {
    const api = new TLSSigAPIv2.Api(SDK_APP_ID, SECRET_KEY);
    return api.genUserSig(userId, expire);
}

/**
 * 生成私有房间 UserSig（带房间权限）
 * @param userId 用户 ID
 * @param roomId 房间 ID
 * @param expire 过期时间（秒）
 */
export function generatePrivateMapKey(
    userId: string,
    roomId: number,
    expire: number = DEFAULT_EXPIRE
): string {
    const api = new TLSSigAPIv2.Api(SDK_APP_ID, SECRET_KEY);
    // 私有房间权限，允许进入指定房间
    const privileges = {
        'room': {
            [roomId]: {
                'privilege': 255  // 所有权限
            }
        }
    };
    return api.genPrivateMapKey(userId, expire, roomId, JSON.stringify(privileges));
}

export default {
    generateUserSig,
    generatePrivateMapKey,
};
