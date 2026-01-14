// 智会 - 环境变量配置验证
// 在应用启动时调用，确保所有必需配置已设置

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * 验证所有必需的环境变量
 * @throws 如果缺少必需的环境变量
 */
export function validateConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必需的环境变量
    const required = [
        { key: 'VITE_TRTC_SDK_APP_ID', description: 'TRTC SDK App ID' },
        { key: 'VITE_API_URL', description: 'Backend API URL' },
    ];

    // 推荐的环境变量
    const recommended = [
        { key: 'VITE_UNIAUTH_BASE_URL', description: 'UniAuth SSO URL' },
        { key: 'VITE_UNIAUTH_CLIENT_ID', description: 'UniAuth Client ID' },
    ];

    // 检查必需变量
    for (const { key, description } of required) {
        const value = import.meta.env[key];
        if (!value || value === 'undefined') {
            errors.push(`缺少必需的环境变量: ${key} (${description})`);
        }
    }

    // 检查 SDK_APP_ID 是否为有效数字
    const sdkAppId = import.meta.env.VITE_TRTC_SDK_APP_ID;
    if (sdkAppId && (isNaN(Number(sdkAppId)) || Number(sdkAppId) <= 0)) {
        errors.push('VITE_TRTC_SDK_APP_ID 必须是有效的正整数');
    }

    // 检查推荐变量
    for (const { key, description } of recommended) {
        const value = import.meta.env[key];
        if (!value || value === 'undefined') {
            warnings.push(`推荐设置环境变量: ${key} (${description})`);
        }
    }

    // 验证 URL 格式
    const urlVars = ['VITE_API_URL', 'VITE_UNIAUTH_BASE_URL'];
    for (const key of urlVars) {
        const value = import.meta.env[key];
        if (value && value !== 'undefined') {
            try {
                new URL(value);
            } catch {
                errors.push(`${key} 不是有效的 URL 格式: ${value}`);
            }
        }
    }

    const isValid = errors.length === 0;

    // 开发环境下输出配置状态
    if (import.meta.env.DEV) {
        if (isValid) {
            console.log('✅ 环境变量配置验证通过');
        } else {
            console.error('❌ 环境变量配置验证失败:', errors);
        }
        if (warnings.length > 0) {
            console.warn('⚠️ 配置警告:', warnings);
        }
    }

    return { isValid, errors, warnings };
}

/**
 * 获取经过验证的配置
 * @throws 如果配置无效
 */
export function getValidatedConfig() {
    const result = validateConfig();

    if (!result.isValid) {
        throw new Error(
            `配置验证失败:\n${result.errors.join('\n')}\n\n` +
            '请确保在 .env 文件中设置了所有必需的环境变量。'
        );
    }

    return {
        trtcSdkAppId: Number(import.meta.env.VITE_TRTC_SDK_APP_ID),
        apiUrl: import.meta.env.VITE_API_URL,
        uniAuthBaseUrl: import.meta.env.VITE_UNIAUTH_BASE_URL || '',
        uniAuthClientId: import.meta.env.VITE_UNIAUTH_CLIENT_ID || '',
    };
}

export default { validateConfig, getValidatedConfig };
