// 智会 - 环境变量类型声明

/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TRTC_SDK_APP_ID: string;
    readonly VITE_TRTC_SECRET_KEY: string;
    readonly VITE_COS_BUCKET: string;
    readonly VITE_COS_REGION: string;
    readonly VITE_COS_SECRET_ID: string;
    readonly VITE_COS_SECRET_KEY: string;
    readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
