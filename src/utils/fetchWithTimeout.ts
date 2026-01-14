// 智会 - 带超时和取消支持的 fetch 封装

/**
 * 创建一个带超时功能的 fetch 请求
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeout 超时时间（毫秒），默认 30000ms
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = 30000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`请求超时 (${timeout}ms): ${url}`);
        }
        throw error;
    }
}

/**
 * 带超时的 JSON 请求
 */
export async function fetchJson<T>(
    url: string,
    options: RequestInit = {},
    timeout = 30000
): Promise<T> {
    const response = await fetchWithTimeout(url, options, timeout);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

/**
 * 带超时的 POST JSON 请求
 */
export async function postJson<T>(
    url: string,
    data: unknown,
    options: RequestInit = {},
    timeout = 30000
): Promise<T> {
    return fetchJson<T>(
        url,
        {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(data),
        },
        timeout
    );
}

export default { fetchWithTimeout, fetchJson, postJson };
