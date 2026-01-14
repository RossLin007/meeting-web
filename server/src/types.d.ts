// 类型声明扩展

declare module 'tls-sig-api-v2' {
    export class Api {
        constructor(sdkAppId: number, secretKey: string);
        genUserSig(userId: string, expire: number): string;
        genPrivateMapKey(userId: string, expire: number, roomId: number, privilegeMap?: string): string;
    }
}

