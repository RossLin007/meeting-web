# 智会 (ZhiHui Meeting) - 技术架构文档

> 📅 生成时间: 2026-01-23  
> 🎯 版本: v0.1.0  
> 📝 用途: 用于在其他 AI 工具中重建项目

---

## 一、项目概述

**智会 (ZhiHui Meeting)** 是一个基于腾讯云服务的智能会议系统,支持实时音视频通话、会议录制、语音转文字等功能。

### 核心功能

- 🎥 **实时音视频**: 基于腾讯云 TRTC SDK v5
- 💬 **即时通讯**: 基于腾讯云 IM SDK
- 📹 **会议录制**: 自动云端录制,支持单流和混流
- 📝 **智能转录**: 录音自动转文字（ASR）
- 🌐 **多端支持**: PC、移动端、平板响应式设计
- 🌍 **国际化**: 中文/英文双语支持
- 🎨 **主题切换**: Light/Dark/System 模式

---

## 二、技术栈总览

### 前端技术栈

| 分类 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **框架** | React | ^19.2.0 | UI 框架 |
| **语言** | TypeScript | ~5.9.3 | 静态类型 |
| **构建工具** | Vite | ^7.2.4 | 开发/构建 |
| **路由** | React Router DOM | ^7.7.0 | 客户端路由 |
| **状态管理** | Zustand | ^5.0.5 | 轻量级状态管理 |
| **实时通信** | Socket.io-client | ^4.8.3 | WebSocket 通信 |
| **音视频** | trtc-sdk-v5 | ^5.10.0 | 腾讯云实时音视频 |
| **即时通讯** | @tencentcloud/chat | ^3.5.0 | 腾讯云 IM |
| **国际化** | i18next + react-i18next | ^25.2.1 / ^16.4.1 | 多语言支持 |
| **认证** | @55387.ai/uniauth-client | ^1.1.3 | 统一认证客户端 |
| **样式** | CSS Modules | - | 组件级样式隔离 |
| **视频播放** | hls.js | ^1.6.15 | HLS 流播放 |
| **文档预览** | pdfjs-dist | ^4.8.69 | PDF 预览 |
| **测试** | Vitest | ^3.2.4 | 单元测试 |

### 后端技术栈

| 分类 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **框架** | Express | ^4.18.2 | Node.js Web 框架 |
| **语言** | TypeScript | ^5.3.0 | 静态类型 |
| **数据库** | Better-SQLite3 | ^12.6.0 | SQLite 数据库 |
| **实时通信** | Socket.io | ^4.8.3 | WebSocket 服务端 |
| **认证** | @55387.ai/uniauth-server | ^1.1.1 | 统一认证服务端 |
| **云服务** | Tencent Cloud SDKs | - | TRTC、COS 等 |
| **签名生成** | tls-sig-api-v2 | ^1.0.2 | TRTC UserSig |
| **对象存储** | cos-nodejs-sdk-v5 | ^2.15.4 | 腾讯云 COS |
| **运行时** | tsx | ^4.7.0 | TypeScript 执行器 |

### Worker 技术栈

| 分类 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **语言** | TypeScript | ^5.7.2 | 静态类型 |
| **数据库** | Better-SQLite3 | ^11.6.0 | SQLite 数据库 |
| **日志** | Pino | ^9.6.0 | 高性能日志库 |
| **对象存储** | cos-nodejs-sdk-v5 | ^2.14.6 | 腾讯云 COS |
| **ASR** | 阿里云 DashScope | - | 语音转文字服务 |

---

## 三、项目结构

### 整体目录结构

```
/Users/lintaijun/Repo/dev/meeting/web/
├── src/                        # 前端源代码
├── server/                     # 后端服务
├── worker/                     # 转录 Worker 服务
├── docs/                       # 项目文档
├── public/                     # 静态资源
├── dist/                       # 构建产物
├── package.json                # 前端依赖配置
├── vite.config.ts              # Vite 配置
├── tsconfig.app.json           # 前端 TS 配置
├── tsconfig.node.json          # Node.js TS 配置
└── README.md                   # 项目说明
```

### 前端目录结构 (`src/`)

```
src/
├── App.tsx                     # 应用入口组件
├── main.tsx                    # 应用启动文件
├── vite-env.d.ts               # Vite 环境类型定义
├── components/                 # React 组件
│   ├── common/                 # 通用组件 (Button, Toast, Dialog, etc.)
│   ├── contacts/               # 联系人相关组件
│   ├── home/                   # 首页相关组件
│   ├── meeting/                # 会议室相关组件
│   ├── settings/               # 设置相关组件
│   ├── user/                   # 用户相关组件
│   ├── icons/                  # 图标组件
│   ├── ErrorBoundary.tsx       # 错误边界
│   ├── PrivateRoute.tsx        # 路由守卫
│   ├── Layout.tsx              # 主布局
│   └── ...
├── pages/                      # 页面组件
│   ├── Dashboard.tsx           # 主面板
│   ├── Login.tsx               # 登录页
│   ├── Meeting.tsx             # 会议室页面
│   ├── PreJoin.tsx             # 预加入页面
│   ├── Meetings.tsx            # 会议列表
│   ├── Storage.tsx             # 文件存储
│   ├── Contacts.tsx            # 联系人
│   ├── Recordings.tsx          # 录制文件
│   └── Transcriptions.tsx      # 转录记录
├── services/                   # 服务层
│   ├── apiClient.ts            # HTTP 客户端
│   ├── store.ts                # Zustand Store
│   ├── socket.ts               # Socket.io 客户端
│   ├── trtc.ts                 # TRTC SDK 封装
│   ├── im.ts                   # IM SDK 封装
│   ├── meetingApi.ts           # 会议 API
│   ├── meetingService.ts       # 会议服务
│   └── contactsApi.ts          # 联系人 API
├── hooks/                      # 自定义 Hooks
│   ├── index.ts                # Hooks 导出
│   ├── useTRTC.ts              # TRTC 相关逻辑
│   ├── useSocket.ts            # Socket 相关逻辑
│   ├── useIM.ts                # IM 相关逻辑
│   ├── useMeetingRoom.ts       # 会议室状态
│   ├── useRoomState.ts         # 房间状态
│   ├── useMeetingHandlers.ts   # 会议事件处理
│   ├── useRecording.ts         # 录制逻辑
│   ├── useRemoteVideo.ts       # 远程视频
│   ├── usePermissions.ts       # 权限管理
│   ├── useTheme.ts             # 主题切换
│   └── useSettingsStorage.ts   # 设置存储
├── contexts/                   # React Context
│   ├── AuthContext.tsx         # 认证上下文
│   └── ThemeContext.tsx        # 主题上下文
├── i18n/                       # 国际化配置
│   ├── index.ts                # i18n 初始化
│   ├── zh.json                 # 中文语言包
│   └── en.json                 # 英文语言包
├── styles/                     # 全局样式
│   └── index.css               # 全局 CSS
├── types/                      # TypeScript 类型定义
│   └── index.ts                # 类型导出
├── utils/                      # 工具函数
├── config/                     # 配置文件
└── assets/                     # 静态资源
```

### 后端目录结构 (`server/`)

```
server/
├── src/
│   ├── index.ts                # 服务入口
│   ├── types.d.ts              # 类型定义
│   ├── db/                     # 数据库
│   │   └── schema.ts           # 数据库表结构
│   ├── routes/                 # API 路由
│   │   ├── meetings.ts         # 会议管理
│   │   ├── users.ts            # 用户管理
│   │   ├── usersig.ts          # UserSig 生成
│   │   ├── recording.ts        # 录制管理
│   │   ├── transcription.ts    # 转录管理
│   │   ├── contacts.ts         # 联系人管理
│   │   └── storage.ts          # 文件存储
│   ├── services/               # 服务层
│   │   ├── trtc.ts             # TRTC 服务
│   │   ├── recording.ts        # 录制服务
│   │   ├── cos.ts              # COS 服务
│   │   └── ...
│   ├── socket/                 # Socket.io
│   │   ├── index.ts            # Socket 初始化
│   │   ├── handlers.ts         # 事件处理器
│   │   └── ...
│   ├── utils/                  # 工具函数
│   └── data/                   # 数据文件
├── package.json                # 依赖配置
├── tsconfig.json               # TypeScript 配置
├── .env                        # 环境变量
└── .env.example                # 环境变量示例
```

### Worker 目录结构 (`worker/`)

```
worker/
├── src/
│   ├── index.ts                # Worker 入口
│   ├── config.ts               # 配置管理
│   ├── db.ts                   # 数据库连接
│   ├── workers/                # Worker 逻辑
│   │   ├── submitter.ts        # 任务提交器
│   │   ├── poller.ts           # 任务轮询器
│   │   └── merger.ts           # 转录合并器
│   ├── services/               # 服务层
│   │   └── transcription.ts   # 转录服务
│   └── utils/                  # 工具函数
│       ├── logger.ts           # 日志工具
│       └── cos.ts              # COS 工具
├── package.json                # 依赖配置
├── tsconfig.json               # TypeScript 配置
└── .env                        # 环境变量
```

---

## 四、核心架构设计

### 4.1 前端架构

#### 路由设计

使用 React Router v7,路由配置在 `App.tsx`:

```typescript
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/auth/callback" element={<Dashboard />} />
  <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
  <Route path="/meetings" element={<PrivateRoute><Meetings /></PrivateRoute>} />
  <Route path="/storage" element={<PrivateRoute><Storage /></PrivateRoute>} />
  <Route path="/contacts" element={<PrivateRoute><Contacts /></PrivateRoute>} />
  <Route path="/recordings" element={<PrivateRoute><Recordings /></PrivateRoute>} />
  <Route path="/transcriptions" element={<PrivateRoute><Transcriptions /></PrivateRoute>} />
  <Route path="/prejoin/:roomId" element={<PrivateRoute><PreJoin /></PrivateRoute>} />
  <Route path="/meeting/:roomId" element={<PrivateRoute><Meeting /></PrivateRoute>} />
</Routes>
```

**路由守卫**: `PrivateRoute.tsx` 检查用户认证状态,未登录则重定向到 `/login`。

#### 状态管理

**Zustand Store** (`src/services/store.ts`):

```typescript
interface MeetingState {
  // 用户状态
  currentUser: User;
  
  // 会议状态
  currentMeeting: Meeting | null;
  members: MeetingMember[];
  
  // 本地音视频状态
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  
  // 会议列表
  meetingList: Meeting[];
  
  // 主题
  theme: ThemeColor;
  
  // Actions
  setCurrentUser: (user: User) => void;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  addMember: (member: MeetingMember) => void;
  removeMember: (userId: string) => void;
  updateMember: (userId: string, updates: Partial<MeetingMember>) => void;
  // ... 其他 actions
}
```

**Context 管理**:
- `AuthContext`: 认证状态（login, logout, getUserInfo）
- `ThemeContext`: 主题切换（light, dark, system）

#### 组件架构

**设计原则**:
- 组件采用 **CSS Modules** 隔离样式
- 遵循 **FanDesign** 设计系统规范
- 函数式组件 + Hooks
- 通用组件放在 `components/common/`

**通用组件** (`components/common/`):
- `Toast`: 通知系统
- `Dialog`: 对话框
- `Button`: 按钮
- `Input`: 输入框
- `Modal`: 模态框
- `Loading`: 加载指示器
- `EmptyState`: 空状态

#### 服务层设计

**API 客户端** (`services/apiClient.ts`):
- 封装 fetch
- 自动处理认证 Token
- 统一错误处理

**Socket.io 客户端** (`services/socket.ts`):
- 房间加入/离开
- 成员状态同步
- 聊天消息
- 录制状态同步
- TRTC 状态同步

**TRTC 封装** (`services/trtc.ts`):
- 初始化 SDK
- 加入/离开房间
- 音视频流管理
- 屏幕共享

**IM 封装** (`services/im.ts`):
- 登录/登出
- 发送/接收消息
- 群组管理

### 4.2 后端架构

#### Express 服务器

**入口文件** (`server/src/index.ts`):
- Express 应用初始化
- CORS 配置
- 中间件注册
- 路由注册
- Socket.io 初始化

**API 路由设计**:

| 路由前缀 | 功能 | 文件 |
|---------|------|------|
| `/api/meetings` | 会议管理 | routes/meetings.ts |
| `/api/users` | 用户管理 | routes/users.ts |
| `/api/usersig` | UserSig 生成 | routes/usersig.ts |
| `/api/recording` | 录制管理 | routes/recording.ts |
| `/api/transcription` | 转录管理 | routes/transcription.ts |
| `/api/contacts` | 联系人管理 | routes/contacts.ts |
| `/api/storage` | 文件存储 | routes/storage.ts |

#### Socket.io 服务器

**初始化** (`server/src/socket/index.ts`):
- 认证中间件（验证 userId）
- CORS 配置
- 心跳机制（pingTimeout: 60s, pingInterval: 25s）

**事件处理** (`server/src/socket/handlers.ts`):
- `join-room`: 加入房间
- `leave-room`: 离开房间
- `member-state-changed`: 成员状态变化
- `chat-message`: 聊天消息
- `recording-state-changed`: 录制状态变化
- `trtc-state-changed`: TRTC 状态变化

#### 数据库设计

使用 **Better-SQLite3** (同步 API,适合轻量级应用):

**核心表结构** (`server/src/db/schema.ts`):

```sql
-- 会议表
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  room_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  host_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'scheduled', 'active', 'ended'
  start_time TEXT,
  end_time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 会议成员表
CREATE TABLE meeting_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  left_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

-- 录制表
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'recording', 'completed', 'failed'
  cos_file_key TEXT,
  file_url TEXT,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

-- 转录表
CREATE TABLE transcriptions (
  id TEXT PRIMARY KEY,
  recording_id TEXT,
  room_id TEXT NOT NULL,
  task_id TEXT UNIQUE,
  status TEXT NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
```

### 4.3 Worker 服务架构

独立的转录 Worker 服务,负责:
1. 扫描 COS 录制文件
2. 提交 ASR 转录任务
3. 轮询任务结果
4. 合并多用户转录结果

**Worker 组件**:

**Submitter Worker** (`worker/src/workers/submitter.ts`):
- 定期扫描 COS bucket
- 识别新录制文件
- 创建转录任务记录
- 提交到 ASR 服务

**Poller Worker** (`worker/src/workers/poller.ts`):
- 轮询进行中的任务
- 获取转录结果
- 更新数据库状态

**Merger Worker** (`worker/src/workers/merger.ts`):
- 合并同一会议的多个转录
- 生成完整会议转录

### 4.4 数据流

#### 创建会议

```
[Frontend] 
  -> POST /api/meetings
    -> [Backend] 创建会议记录
      -> 生成 roomId
      -> 返回会议信息
  -> [Frontend] 跳转到 /prejoin/:roomId
```

#### 加入会议

```
[Frontend]
  -> POST /api/usersig/generate (获取 UserSig)
  -> TRTC.enterRoom(roomId, userSig)
  -> Socket.emit('join-room', { roomId, userId })
    -> [Backend] Socket.on('join-room')
      -> 更新 meeting_members 表
      -> Socket.to(roomId).emit('member-joined', memberInfo)
  -> [Frontend] Socket.on('member-joined')
    -> Store.addMember(memberInfo)
```

#### 录制流程

```
[Frontend] 点击录制
  -> POST /api/recording/start
    -> [Backend] 调用 TRTC 云端录制 API
      -> 创建 recordings 表记录
      -> 返回 taskId
    -> Socket.to(roomId).emit('recording-state-changed', { status: 'recording' })
  -> [Frontend] 更新 UI

[Tencent Cloud] 录制完成
  -> POST /api/recording/callback
    -> [Backend] 更新 recordings 表
      -> 设置 cos_file_key, file_url, status='completed'
    -> Socket.to(roomId).emit('recording-state-changed', { status: 'completed' })

[Worker] Submitter
  -> 扫描 COS
  -> 创建 transcriptions 记录
  -> 提交 ASR 任务

[Worker] Poller
  -> 轮询 ASR 结果
  -> 更新 transcriptions 表
```

---

## 五、关键配置

### 5.1 前端配置

**Vite 配置** (`vite.config.ts`):

```typescript
export default defineConfig({
  plugins: [react(), requestLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**TypeScript 配置** (`tsconfig.app.json`):
- target: ES2022
- module: ESNext
- jsx: react-jsx
- strict: true
- moduleResolution: bundler
- Path alias: `@/*` -> `src/*`

**环境变量** (`.env`):
```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_TRTC_SDK_APP_ID=your_app_id
```

### 5.2 后端配置

**环境变量** (`server/.env`):
```bash
PORT=3001
NODE_ENV=development

# 腾讯云 TRTC
TRTC_SDK_APP_ID=your_app_id
TRTC_SECRET_KEY=your_secret_key

# 腾讯云 API
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key

# 腾讯云 COS
COS_BUCKET=your_bucket
COS_REGION=ap-guangzhou

# 腾讯云 IM
IM_SDK_APP_ID=your_im_app_id
IM_ADMIN_USER_ID=administrator
IM_ADMIN_USER_SIG=your_admin_sig

# UniAuth
UNIAUTH_CLIENT_ID=your_client_id
UNIAUTH_CLIENT_SECRET=your_client_secret
UNIAUTH_SSO_URL=https://auth.55387.xyz

# 数据库
DATABASE_PATH=./meeting.db
```

### 5.3 Worker 配置

**环境变量** (`worker/.env`):
```bash
# 数据库
DATABASE_PATH=../server/meeting.db

# 腾讯云 COS
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket
COS_REGION=ap-guangzhou

# 阿里云 DashScope (ASR)
DASHSCOPE_API_KEY=your_api_key

# Worker 配置
SUBMITTER_POLL_INTERVAL=60000
POLLER_POLL_INTERVAL=30000
TASK_TIMEOUT=600000
MAX_RETRIES=3
LOG_LEVEL=info
```

---

## 六、核心依赖说明

### 6.1 腾讯云 SDK

#### TRTC SDK (trtc-sdk-v5)

**用途**: 实时音视频通话

**核心 API**:
- `TRTC.createClient()`: 创建客户端
- `client.enterRoom()`: 加入房间
- `client.exitRoom()`: 离开房间
- `client.startLocalVideo()`: 开启本地视频
- `client.startLocalAudio()`: 开启本地音频
- `client.startScreenShare()`: 开启屏幕共享

#### IM SDK (@tencentcloud/chat)

**用途**: 即时通讯、聊天

**核心 API**:
- `TIM.create()`: 创建 IM 实例
- `tim.login()`: 登录
- `tim.sendMessage()`: 发送消息
- `tim.on(TIM.EVENT.MESSAGE_RECEIVED)`: 接收消息

#### COS SDK (cos-nodejs-sdk-v5)

**用途**: 对象存储,存储录制文件

**核心 API**:
- `cos.getBucket()`: 列出文件
- `cos.getObject()`: 下载文件
- `cos.putObject()`: 上传文件

### 6.2 认证 SDK

#### UniAuth (@55387.ai/uniauth-client & uniauth-server)

**用途**: 统一认证系统

**前端**:
```typescript
import { UniAuthClient } from '@55387.ai/uniauth-client';

const client = new UniAuthClient({
  clientId: 'your_client_id',
  ssoUrl: 'https://auth.55387.xyz',
});

await client.login();
const user = await client.getUserInfo();
```

**后端**:
```typescript
import { createAuthMiddleware } from '@55387.ai/uniauth-server';

const authMiddleware = createAuthMiddleware({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  ssoUrl: 'https://auth.55387.xyz',
});

app.use(authMiddleware);
```

### 6.3 状态管理 (Zustand)

**特点**:
- 轻量级（< 1KB）
- 无需 Provider
- 支持精确订阅

**示例**:
```typescript
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// 使用
const count = useStore((state) => state.count);
const increment = useStore((state) => state.increment);
```

### 6.4 国际化 (i18next)

**配置** (`src/i18n/index.ts`):
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhTranslations },
      en: { translation: enTranslations },
    },
    fallbackLng: 'zh',
  });
```

**使用**:
```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();
const text = t('common.confirm');
i18n.changeLanguage('en');
```

---

## 七、开发和部署

### 7.1 开发环境启动

#### 前端

```bash
cd /Users/lintaijun/Repo/dev/meeting/web
npm install
npm run dev
# 访问 http://localhost:3000
```

#### 后端

```bash
cd /Users/lintaijun/Repo/dev/meeting/web/server
npm install
npm run dev
# 运行在 http://localhost:3001
```

#### Worker

```bash
cd /Users/lintaijun/Repo/dev/meeting/web/worker
npm install
npm run dev
```

### 7.2 构建

#### 前端

```bash
npm run build
# 产物在 dist/ 目录
```

#### 后端

```bash
cd server
npm run build
# 产物在 server/dist/ 目录
```

#### Worker

```bash
cd worker
npm run build
# 产物在 worker/dist/ 目录
```

### 7.3 测试

#### 前端

```bash
npm run test          # 运行测试
npm run test:ui       # 测试 UI
npm run test:coverage # 测试覆盖率
```

**测试框架**: Vitest + @testing-library/react

**测试文件位置**:
- `src/contexts/ThemeContext.test.tsx`
- `src/hooks/useSettingsStorage.test.ts`

---

## 八、设计系统规范

### FanDesign 设计系统

**色彩系统**:
```javascript
{
  primary: "#07C160",        // 微信绿
  success: "#07C160",
  warn: "#FFBE00",
  error: "#FA5151",
  link: "#576B95",
  text: {
    primary: { light: "rgba(0, 0, 0, 0.9)", dark: "rgba(255, 255, 255, 0.8)" },
    secondary: { light: "rgba(0, 0, 0, 0.5)", dark: "rgba(255, 255, 255, 0.5)" },
    tertiary: { light: "rgba(0, 0, 0, 0.3)", dark: "rgba(255, 255, 255, 0.3)" }
  },
  background: {
    page: { light: "#F2F2F2", dark: "#111111" },
    cell: { light: "#FFFFFF", dark: "#191919" }
  }
}
```

**间距系统**:
- unit: 4px
- page_edge: 16px
- element_gap: 8px

**圆角**:
- button: 8px
- card: 12px
- input: 4px

**字体**:
- base_font_size: 17px
- h1: 20px (bold)
- body: 17px (normal)
- caption: 14px
- small: 12px

---

## 九、API 接口文档

### 9.1 会议相关

#### POST `/api/meetings`
创建会议

**请求体**:
```json
{
  "title": "测试会议",
  "hostId": "user_123",
  "startTime": "2026-01-23T10:00:00Z"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "meeting_xxx",
    "roomId": "room_xxx",
    "title": "测试会议",
    "hostId": "user_123",
    "status": "scheduled",
    "startTime": "2026-01-23T10:00:00Z"
  }
}
```

#### GET `/api/meetings/:id`
获取会议详情

#### POST `/api/meetings/:id/join`
加入会议

#### POST `/api/meetings/:id/leave`
离开会议

### 9.2 录制相关

#### POST `/api/recording/start`
开始录制

**请求体**:
```json
{
  "roomId": "room_xxx",
  "userId": "user_123"
}
```

#### POST `/api/recording/stop`
停止录制

#### POST `/api/recording/callback`
录制回调（由腾讯云调用）

### 9.3 UserSig 生成

#### POST `/api/usersig/generate`
生成 TRTC UserSig

**请求体**:
```json
{
  "userId": "user_123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userSig": "eJw...",
    "sdkAppId": 1400xxx
  }
}
```

### 9.4 转录相关

#### GET `/api/transcription/room/:roomId`
获取会议转录

#### GET `/api/transcription/:id`
获取转录详情

---

## 十、Socket.io 事件

### 客户端 -> 服务端

| 事件名 | 说明 | 数据 |
|--------|------|------|
| `join-room` | 加入房间 | `{ roomId, userId, userName }` |
| `leave-room` | 离开房间 | `{ roomId, userId }` |
| `member-state-changed` | 成员状态变化 | `{ roomId, userId, isMicOn, isCameraOn }` |
| `chat-message` | 发送聊天消息 | `{ roomId, userId, message }` |
| `recording-state-changed` | 录制状态变化 | `{ roomId, status }` |
| `trtc-state-changed` | TRTC 状态变化 | `{ roomId, userId, state }` |

### 服务端 -> 客户端

| 事件名 | 说明 | 数据 |
|--------|------|------|
| `member-joined` | 有新成员加入 | `{ userId, userName }` |
| `member-left` | 成员离开 | `{ userId }` |
| `member-state-updated` | 成员状态更新 | `{ userId, isMicOn, isCameraOn }` |
| `chat-message` | 收到聊天消息 | `{ userId, userName, message, timestamp }` |
| `recording-state-changed` | 录制状态变化 | `{ status, recordingId }` |
| `trtc-state-changed` | TRTC 状态变化 | `{ userId, state }` |

---

## 十一、重建项目清单

### 环境准备

- [ ] Node.js >= 18
- [ ] npm 或 pnpm
- [ ] 腾讯云账号（TRTC、COS、IM）
- [ ] 阿里云 DashScope 账号（ASR）
- [ ] UniAuth 客户端凭证

### 前端重建步骤

1. **初始化项目**
   ```bash
   npm create vite@latest meeting-web -- --template react-ts
   cd meeting-web
   ```

2. **安装依赖**
   ```bash
   npm install react react-dom react-router-dom zustand socket.io-client
   npm install trtc-sdk-v5 @tencentcloud/chat hls.js pdfjs-dist
   npm install i18next react-i18next i18next-browser-languagedetector
   npm install @55387.ai/uniauth-client clsx dompurify @types/dompurify
   npm install -D @vitejs/plugin-react typescript vite vitest
   npm install -D @testing-library/react @testing-library/jest-dom jsdom
   ```

3. **创建目录结构**
   ```bash
   mkdir -p src/{components,pages,services,hooks,contexts,i18n,styles,types,utils,config,assets}
   mkdir -p src/components/{common,contacts,home,meeting,settings,user,icons}
   ```

4. **配置 Vite** (参考第五章配置)

5. **配置 TypeScript** (参考第五章配置)

6. **实现核心代码** (参考第四章架构)

### 后端重建步骤

1. **初始化项目**
   ```bash
   mkdir server && cd server
   npm init -y
   ```

2. **安装依赖**
   ```bash
   npm install express cors dotenv socket.io
   npm install better-sqlite3 @types/better-sqlite3
   npm install tencentcloud-sdk-nodejs-trtc tls-sig-api-v2 cos-nodejs-sdk-v5
   npm install @55387.ai/uniauth-server uuid @types/uuid
   npm install -D @types/express @types/cors @types/node typescript tsx
   ```

3. **创建目录结构**
   ```bash
   mkdir -p src/{routes,services,socket,db,utils,data}
   ```

4. **配置 TypeScript**
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "node",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true
     }
   }
   ```

5. **实现核心代码** (参考第四章架构)

### Worker 重建步骤

1. **初始化项目**
   ```bash
   mkdir worker && cd worker
   npm init -y
   ```

2. **安装依赖**
   ```bash
   npm install better-sqlite3 cos-nodejs-sdk-v5 dotenv pino pino-pretty uuid
   npm install -D @types/better-sqlite3 @types/node @types/uuid typescript tsx
   ```

3. **创建目录结构**
   ```bash
   mkdir -p src/{workers,services,utils}
   ```

4. **实现核心代码** (参考第四章架构)

---

## 十二、常见问题

### Q1: 如何配置腾讯云服务?

**A**: 需要在腾讯云控制台创建:
1. TRTC 应用 -> 获取 SDKAppID 和 SecretKey
2. IM 应用 -> 获取 IMAppID
3. COS bucket -> 配置 CORS 和录制回调

### Q2: 录制文件在哪里?

**A**: 录制文件存储在腾讯云 COS,路径格式为:
```
/${roomId}/${taskId}/${userId}_${timestamp}.m3u8
```

### Q3: 如何添加新语言?

**A**:
1. 在 `src/i18n/` 创建新语言文件（如 `ja.json`）
2. 在 `src/i18n/index.ts` 注册语言
3. 更新设置页面的语言选项

### Q4: 如何自定义设计系统?

**A**: 修改 CSS 变量和 FanDesign 配置:
1. 更新 `src/styles/index.css` 中的 CSS 变量
2. 调整 `user_rules` 中的 FanDesign JSON 配置
3. 重启开发服务器

---

## 十三、参考资料

### 官方文档

- [TRTC Web SDK](https://cloud.tencent.com/document/product/647/16788)
- [IM Web SDK](https://cloud.tencent.com/document/product/269/37411)
- [腾讯云 COS](https://cloud.tencent.com/document/product/436)
- [React 官方文档](https://react.dev/)
- [Zustand 文档](https://zustand.docs.pmnd.rs/)
- [Socket.io 文档](https://socket.io/docs/)

### 项目资源

- 项目路径: `/Users/lintaijun/Repo/dev/meeting/web`
- 前端端口: `3000`
- 后端端口: `3001`

---

**文档版本**: v1.0  
**最后更新**: 2026-01-23  
**维护者**: RossLin007
