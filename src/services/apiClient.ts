// 智会 - API 客户端基础类

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const DEFAULT_TIMEOUT = 30000;

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
}

/**
 * API 客户端基类
 * 提供统一的请求方法、错误处理和类型安全
 */
export class ApiClient {
    private baseUrl: string;
    private timeout: number;
    private defaultHeaders: Record<string, string>;

    constructor(config: ApiClientConfig) {
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...config.headers,
        };
    }

    /**
     * 发送 GET 请求
     */
    async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
        const url = this.buildUrl(endpoint, params);
        return this.request<T>(url, { method: 'GET' });
    }

    /**
     * 发送 POST 请求
     */
    async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
        const url = this.buildUrl(endpoint);
        return this.request<T>(url, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * 发送 PUT 请求
     */
    async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
        const url = this.buildUrl(endpoint);
        return this.request<T>(url, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * 发送 DELETE 请求
     */
    async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
        const url = this.buildUrl(endpoint);
        return this.request<T>(url, { method: 'DELETE' });
    }

    /**
     * 构建完整 URL
     */
    private buildUrl(endpoint: string, params?: Record<string, string>): string {
        const url = new URL(endpoint, this.baseUrl);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }
        return url.toString();
    }

    /**
     * 核心请求方法
     */
    private async request<T>(url: string, options: RequestInit): Promise<ApiResponse<T>> {
        try {
            const response = await fetchWithTimeout(url, {
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers,
                },
            }, this.timeout);

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || data.error || `HTTP ${response.status}`,
                };
            }

            // 如果后端返回的数据已经符合 ApiResponse 格式
            if (typeof data === 'object' && 'success' in data) {
                return data as ApiResponse<T>;
            }

            // 否则包装为标准格式
            return {
                success: true,
                data: data as T,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '请求失败';
            console.error('❌ API 请求失败:', url, errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
}

// 创建默认 API 客户端实例
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = new ApiClient({
    baseUrl: API_BASE_URL,
});

export default apiClient;
