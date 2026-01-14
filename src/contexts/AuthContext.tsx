// 智会 - 认证上下文

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { UniAuthClient } from '@55387.ai/uniauth-client';

// 从环境变量读取配置（移除硬编码后备值以提高安全性）
const UNIAUTH_BASE_URL = import.meta.env.VITE_UNIAUTH_BASE_URL;
const UNIAUTH_CLIENT_ID = import.meta.env.VITE_UNIAUTH_CLIENT_ID;

// 验证必需的配置
if (!UNIAUTH_BASE_URL || !UNIAUTH_CLIENT_ID) {
    console.error('❌ 缺少 UniAuth 配置，请设置 VITE_UNIAUTH_BASE_URL 和 VITE_UNIAUTH_CLIENT_ID');
}

// UniAuth 客户端配置
const uniAuthClient = new UniAuthClient({
    baseUrl: UNIAUTH_BASE_URL || '',
    clientId: UNIAUTH_CLIENT_ID || '',
});

// 配置 SSO
uniAuthClient.configureSso({
    ssoUrl: UNIAUTH_BASE_URL || '',
    clientId: UNIAUTH_CLIENT_ID || '',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : '',
    scope: 'openid profile email phone',
});

// 用户类型
export interface User {
    id: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    avatar?: string | null;
}

// 认证上下文类型
interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: () => void;
    logout: () => void;
    // 用于 TRTC 的用户 ID 和 UserSig
    userId: string;
    userSig: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token 存储 key
const TOKEN_KEY = 'uniauth_token';
const USER_KEY = 'uniauth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSig, setUserSig] = useState('');

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // 初始化：从 localStorage 恢复登录状态（带安全验证）
    useEffect(() => {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                // 验证用户对象结构
                if (parsedUser && typeof parsedUser.id === 'string' && typeof parsedUser.username === 'string') {
                    setToken(storedToken);
                    setUser(parsedUser);
                    generateUserSig(parsedUser.id);
                } else {
                    console.warn('⚠️ 存储的用户数据格式无效，已清理');
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(USER_KEY);
                }
            } catch (error) {
                console.error('❌ 解析存储的用户数据失败:', error);
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
            }
        }
        setIsLoading(false);
    }, []);

    // 处理 SSO 回调 - 使用 ref 防止 React StrictMode 下双重执行
    const callbackProcessedRef = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            // 防止 React StrictMode 下双重执行
            if (callbackProcessedRef.current) {
                console.log('[Auth] SSO callback already processed, skipping');
                return;
            }

            // 检查 URL 是否包含 OAuth 错误
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');

            if (error) {
                console.error('❌ OAuth error:', error, '-', errorDescription);
                callbackProcessedRef.current = true;
                // 清理 URL 并重定向到登录页
                window.history.replaceState({}, '', '/login');
                setIsLoading(false);
                return;
            }

            // 检查是否是 SSO 回调
            if (uniAuthClient.isSSOCallback()) {
                callbackProcessedRef.current = true; // 标记为已处理
                setIsLoading(true);
                try {
                    const result = await uniAuthClient.handleSSOCallback();

                    if (result) {
                        // 调试：打印 SSO 返回的完整用户信息
                        console.log('🔑 SSO 用户信息:', JSON.stringify(result.user, null, 2));

                        const userData: User = {
                            id: result.user.id,
                            username: result.user.nickname || result.user.email?.split('@')[0] || result.user.phone || result.user.id,
                            email: result.user.email,
                            phone: result.user.phone,
                            avatar: result.user.avatar_url,
                        };

                        setToken(result.access_token);
                        setUser(userData);
                        localStorage.setItem(TOKEN_KEY, result.access_token);
                        localStorage.setItem(USER_KEY, JSON.stringify(userData));

                        // 生成 UserSig
                        await generateUserSig(userData.id);

                        // 注册用户到后端数据库
                        try {
                            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                            await fetch(`${apiUrl}/api/users/register`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    id: userData.id,
                                    name: userData.username,
                                    email: userData.email,
                                    avatar: userData.avatar,
                                }),
                            });
                            console.log('✅ 用户注册到后端数据库成功:', userData.username);
                        } catch (e) {
                            console.warn('⚠️ 用户注册到后端数据库失败:', e);
                        }

                        // 获取登录前的路径
                        const redirectPath = localStorage.getItem('redirect_after_login') || '/';
                        localStorage.removeItem('redirect_after_login');

                        // 跳转到之前的页面
                        window.location.href = redirectPath;
                    }
                } catch (error) {
                    console.error('SSO callback failed:', error);
                    callbackProcessedRef.current = false; // 失败时重置，允许重试
                }
                setIsLoading(false);
            }
        };

        handleCallback();
    }, []);

    // 生成 UserSig
    const generateUserSig = async (userId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/usersig/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();
            if (data.success) {
                setUserSig(data.data.userSig);
            }
        } catch (error) {
            console.error('Failed to generate UserSig:', error);
        }
    };

    // 登录 - 启动 SSO 登录流程
    const login = () => {
        uniAuthClient.loginWithSSO();
    };

    // 退出
    const logout = async () => {
        try {
            await uniAuthClient.logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
        setUser(null);
        setToken(null);
        setUserSig('');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoggedIn: !!user && !!token,
                isLoading,
                login,
                logout,
                userId: user?.id || '',
                userSig,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// Hook
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
