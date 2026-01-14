// 智会 - 路由守卫组件

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PrivateRouteProps {
    children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
    const { isLoggedIn, isLoading } = useAuth();
    const location = useLocation();

    // 加载中显示空白
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--color-background, #0a0a0a)',
                color: 'var(--color-text, #fff)'
            }}>
                加载中...
            </div>
        );
    }

    // 未登录重定向到登录页面
    if (!isLoggedIn) {
        // 保存当前路径，登录后返回
        localStorage.setItem('redirect_after_login', location.pathname + location.search);

        // 重定向到登录页面
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

export default PrivateRoute;
