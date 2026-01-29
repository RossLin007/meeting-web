# 智会 (ZhiHui Meeting) - 产品需求文档 (PRD)

> **版本**: v1.0  
> **创建日期**: 2026-01-21  
> **最后更新**: 2026-01-21  
> **状态**: 已发布

---

## 1. 概述 (Overview)

### 1.1 产品简介
**智会**是一款基于腾讯云 TRTC（实时音视频）技术构建的企业级在线会议系统。产品提供高质量的音视频通话、实时聊天、屏幕共享、会议录制、语音转写等核心功能，旨在为团队协作提供高效、稳定的远程沟通解决方案。

### 1.2 产品愿景
打造一个简洁、高效、可靠的在线会议平台，让远程协作变得更加便捷和专业。

### 1.3 目标用户
| 用户类型 | 描述 | 核心需求 |
|---------|------|---------|
| 企业员工 | 日常需要远程协作的职场人士 | 高质量音视频通话、便捷入会、屏幕共享 |
| 会议主持人 | 组织和主持会议的管理者 | 成员管理、录制控制、会议预约 |
| 项目团队 | 需要频繁进行项目会议的团队 | 即时通讯、文件共享、会议记录 |

### 1.4 技术架构
- **前端**: React 19 + TypeScript + Vite
- **后端**: Node.js + Express + Socket.io
- **数据库**: SQLite (meeting.db)
- **音视频**: 腾讯云 TRTC SDK v5
- **即时通讯**: 腾讯云 IM SDK
- **对象存储**: 腾讯云 COS
- **认证**: UniAuth SSO 单点登录
- **国际化**: i18next (中/英双语)

---

## 2. 用户界面描述

### 2.1 登录界面
- SSO 单点登录
- 手机号登录
- 邮箱登录

### 2.2 首页 /Dashboard
- 欢迎问候（根据时间段显示早上好/下午好/晚上好）
- 快捷操作：创建会议、加入会议、预约会议
- 会议列表：进行中、即将开始的会议
- 支持网格/列表视图切换
- 会议搜索和筛选
- 一键刷新会议列表

### 2.3 会议 /meetings
- 展示会议列表，会议列表包含会议的详细信息，如会议标题、开始时间、结束时间、主持人、成员等
- 需要分页 20条，50条，100条。
- 支持网格/列表视图切换
- 会议搜索和筛选
- 一键刷新会议列表

### 2.4 转写 /transcripts
- 展示会议的转写列表 以 roomId 和 task_id 为唯一标识 的转写列表
- 需要分页 20条，50条，100条。
- 支持网格/列表视图切换
- 会议搜索和筛选
- 一键刷新会议列表

### 2.5 联系人 /contacts
- 展示与用户一起参加过会议的用户列表


## 目录结构
new/
├── docs/                  # 项目文档 (PRD, API, 设计稿)
├── web/                   # 前端应用 (React 19 + Vite + TS)
│   ├── src/
│   │   ├── api/           # API 请求封装 (Axios)
│   │   ├── assets/        # 静态资源 (图片, 字体)
│   │   ├── components/    # 通用 UI 组件 (Toast, Dialog, Notice, Loading)
│   │   ├── hooks/         # 自定义 React Hooks
│   │   ├── i18n/          # 国际化配置 (i18next)
│   │   ├── layouts/       # 页面布局模板
│   │   ├── pages/         # 业务页面 (Login, Dashboard, Meeting, Transcripts, Contacts)
│   │   ├── store/         # 状态管理 (Zustand/Redux)
│   │   ├── types/         # TypeScript 类型定义
│   │   └── utils/         # 工具函数 (TRTC/IM 封装, 格式化)
│   ├── tests/             # 自动化测试 (Vitest, Playwright/Cypress)
│   └── public/            # 公共静态资源
├── server/                # 后端应用 (Node.js + Express)
│   ├── src/
│   │   ├── controllers/   # 业务控制器
│   │   ├── middleware/    # 中间件 (Auth, Error Handling, Logging)
│   │   ├── models/        # 数据库模型 (SQLite/Sequelize)
│   │   ├── routes/        # 路由定义
│   │   ├── services/      # 核心业务逻辑 (TRTC Token, COS Signature)
│   │   └── socket/        # Socket.io 实时通信逻辑
│   ├── db/                # 数据库文件及迁移脚本 (meeting.db)
│   └── tests/             # 后端单元测试 (Jest)
├── worker/                # 语音转写服务 (Node.js)
│   ├── src/
│   │   ├── processors/    # 任务处理逻辑 (ASR 任务消费)
│   │   ├── services/      # 腾讯云 ASR SDK 封装
│   │   └── utils/         # 通用工具
│   └── tests/             # 自动化测试 (Vitest/Jest)
├── .gitignore             # Git 忽略配置
├── package.json           # 项目依赖及脚本
└── README.md              # 项目启动与开发指南




## 3. 数据结构
### 3.1 核心实体模型

#### User (用户)
| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | String (UUID) | 用户唯一标识 |
| username | String | 用户名/登录账号 |
| nickname | String | 显示昵称 |
| avatar | String | 头像 URL |
| email | String | 电子邮箱 |
| role | Enum | 用户角色 (ADMIN, USER) |
| createdAt | DateTime | 创建时间 |

#### Meeting (会议)
| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | String (UUID) | 会议唯一标识 |
| title | String | 会议标题 |
| description | String | 会议描述 |
| hostId | String | 主持人 ID |
| startTime | DateTime | 计划开始时间 |
| endTime | DateTime | 计划结束时间 |
| actualStartTime | DateTime | 实际开始时间 |
| actualEndTime | DateTime | 实际结束时间 |
| roomId | Number | 腾讯云 TRTC 房间号 |
| status | Enum | 状态 (WAITING, ONGOING, ENDED, CANCELLED) |
| password | String | 入会密码 (可选) |
| isLocked | Boolean | 是否开启会议锁定 |

#### MeetingMember (会议成员)
| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | String (UUID) | 记录唯一标识 |
| meetingId | String | 会议 ID |
| userId | String | 用户 ID |
| role | Enum | 成员角色 (HOST, CO_HOST, SPEAKER, AUDIENCE) |
| joinTime | DateTime | 进入会议时间 |
| leaveTime | DateTime | 离开会议时间 |
| isMuted | Boolean | 是否静音 |
| isCameraOn | Boolean | 是否开启摄像头 |

#### ChatMessage (即时通讯消息)
| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | String | 消息唯一标识 (IM SDK 生成) |
| meetingId | String | 所属会议 ID |
| senderId | String | 发送者 ID |
| content | Text | 消息内容 |
| msgType | Enum | 消息类型 (TEXT, IMAGE, FILE) |
| timestamp | DateTime | 发送时间 |

#### MeetingRecord (会议录制)
| 字段名 | 类型 | 说明 |
|-------|------|------|
| id | String (UUID) | 记录唯一标识 |
| meetingId | String | 会议 ID |
| fileUrl | String | COS 存储地址 |
| duration | Number | 录制时长 (秒) |
| fileSize | Number | 文件大小 |
| transcription | JSON | 语音转写文本内容 |
| createdAt | DateTime | 生成时间 |

会议id meetingId
会议室id roomId
云录制任务Id task_id




## 7. 非功能需求

### 7.1 性能需求
| 指标 | 要求 |
|-----|------|
| 页面首屏加载 | < 3 秒 |
| API 响应时间 | < 500ms |
| 音视频延迟 | < 300ms |

### 7.2 兼容性需求
| 平台 | 版本要求 |
|-----|---------|
| Chrome | 90+ |
| Safari | 14+ |
| Firefox | 88+ |
| Edge | 90+ |
| iOS Safari | 14+ |
| Android Chrome | 90+ |

### 7.3 国际化需求
- 界面语言：简体中文、英文
- 时间格式本地化
- 日期格式本地化

### 7.4 响应式设计
- 桌面端（>1024px）
- 平板端（768px - 1024px）
- 移动端（<768px）

---

## 8. 设计规范

### 8.1 设计系统
遵循 **FanDesign** 凡人学堂设计系统：

| Token | 值 |
|-------|-----|
| 主色 | #07C160 |
| 警告色 | #FA5151 |
| 链接色 | #576B95 |
| 页面背景（浅色）| #F2F2F2 |
| 页面背景（深色）| #111111 |
| 卡片圆角 | 12px |
| 按钮圆角 | 8px |
| 页面边距 | 16px |

### 8.2 响应式断点
| 名称 | 宽度 |
|-----|------|
| 移动端 | < 768px |
| 平板端 | 768px - 1024px |
| 桌面端 | > 1024px |

---

## 9. 依赖项

### 9.1 前端依赖
| 依赖 | 版本 | 用途 |
|-----|------|------|
| react | ^19.2.0 | UI 框架 |
| react-router-dom | ^7.7.0 | 路由 |
| trtc-sdk-v5 | ^5.10.0 | 实时音视频 |
| @tencentcloud/chat | ^3.5.0 | 即时通讯 |
| socket.io-client | ^4.8.3 | 实时通讯 |
| zustand | ^5.0.5 | 状态管理 |
| i18next | ^25.2.1 | 国际化 |
| hls.js | ^1.6.15 | HLS 视频播放 |
| @55387.ai/uniauth-client | ^1.1.3 | SSO 认证 |

### 9.2 开发依赖
| 依赖 | 版本 | 用途 |
|-----|------|------|
| vite | ^7.2.4 | 构建工具 |
| typescript | ~5.9.3 | 类型检查 |
| vitest | ^3.2.4 | 单元测试 |
| @testing-library/react | ^16.3.0 | 组件测试 |

---

## 10. 附录

### 10.1 术语表
| 术语 | 定义 |
|-----|------|
| TRTC | 腾讯云实时音视频 (Tencent Real-Time Communication) |
| IM | 即时通讯 (Instant Messaging) |
| COS | 腾讯云对象存储 (Cloud Object Storage) |
| SSO | 单点登录 (Single Sign-On) |
| UserSig | TRTC 用户签名，用于身份验证 |
| 等候室 | 入会前的审批区域 |
| 主持人 | 拥有会议管理权限的用户 |

### 10.2 相关文档
- [腾讯云 TRTC 文档](https://cloud.tencent.com/document/product/647)
- [腾讯云 IM 文档](https://cloud.tencent.com/document/product/269)
- [UniAuth SSO server 集成指南](https://www.npmjs.com/package/@55387.ai/uniauth-server)
- [UniAuth SSO client 集成指南](https://www.npmjs.com/package/@55387.ai/uniauth-client)

### 10.3 变更记录
| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| v1.0 | 2026-01-21 | 基于源代码分析生成初始 PRD |
