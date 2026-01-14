// 智会 - UniAuth 认证服务

import { UniAuthServer } from '@55387.ai/uniauth-server';

// 初始化 UniAuth Server SDK
export const uniAuth = new UniAuthServer({
    baseUrl: process.env.UNIAUTH_BASE_URL || 'https://sso.55387.xyz',
    clientId: process.env.UNIAUTH_CLIENT_ID || '',
    clientSecret: process.env.UNIAUTH_CLIENT_SECRET || '',
});

// 验证 Token
export async function verifyToken(token: string) {
    try {
        const result = await uniAuth.verifyToken(token);
        return result;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

// 获取用户信息
export async function getUser(token: string) {
    try {
        const result = await uniAuth.getUser(token);
        return result;
    } catch (error) {
        console.error('Get user failed:', error);
        return null;
    }
}

export default uniAuth;
