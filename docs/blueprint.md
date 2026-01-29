# 智会 - 视频会议软件需求规格说明书



## 项目概述

开发一个基于腾讯 TRTC 的 Web 端视频会议软件，支持多人高清视频通话、屏幕共享、会议录制等功能。

## 项目背景
- 给到内在成长，心灵成长的用户，提供一个可以进行视频会议的软件。数据可控，可以进行录制，可以进行转写。这些数据供应后续进一步做AI的分析和挖掘。 目标是帮助用户内在、心性成长。

### 项目定位
- 独立 Web 应用项目
- 未来与 morning 项目配合使用

## 页面设计

### 页面1：登录页面
参考 [login.png](file:///Users/lintaijun/Repo/dev/meeting/web/docs/login.png)

登录页面使用 SSO 登录，登录成功后跳转到 dashboard 页面（首页）。



### 页面1: 首页 (home，也是dashboard)
参考 [home.png](file:///Users/lintaijun/Repo/dev/meeting/web/docs/home.png)

功能：
- 创建会议 (New Room)
- 加入会议 (Join Room)
- 预约会议 (Schedule)
- 会议列表（显示进行中的会议和历史会议，可直接加入）
设置

### 页面2: 会议室页面
参考 [meeting_room.png](file:///Users/lintaijun/Repo/dev/meeting/web/docs/meeting_room.png)

功能：
- 顶部：主题切换 (Theme)、布局 (Layout)、网络稳定性 (Stability)
- 视频区：宫格模式显示参会者
- 底部工具栏：
  - 麦克风、摄像头
  - 屏幕共享、全屏
  - 成员管理
    - 成员列表
    - 成员搜索
    - 改变名称，主持人可以改其他参与人的名称
    - 设置主持人
    - 关闭开启声音
    - 关闭开启视频
    - 主持人可以，踢人
  - 聊天
  - 更多设置
  - 邀请参会者
    - 邀请参与者
    - 分享会议链接
  - 设置
    - 选择语言
    - 选择主题
    - 选择麦克风
    - 选择摄像头
- 结束会议按钮
  - 关闭会议（结束会议）
  - 离开会议室 （会议不关闭）
  - 取消


## 角色

请问一个在线多人视频会议，类似腾讯会议， 他的数据库有哪些实体，库表如何设计。
特别是多人会议的会议室如何管理
多人会议的会议室， 有主持人角色，有参与者角色
参与者可以打开、关闭摄像头，修改自己的名称
共享屏幕， 邀请其他人
选择布局，发送聊天信息，查看聊天信息
进入会议，离开会议
主持人，会议室的拥有者，他可以
参与者可以打开、关闭摄像头，修改自己的名称
共享屏幕， 邀请其他人
选择布局，发送聊天信息，查看聊天信息
进入会议，离开会议
结束会议（关闭会议，把参与者都清理出会议室）
修改自己和他的名字， 可以关闭自己和他的视频，音频
可以禁止他人发言
录制视频，关闭录制

## 规则

整个软件只有登录了才能访问，登录页面使用 SSO 登录。
- 加入会议
  - 会议室只有通过新建或者预约才能创建， 只有创建了才能加入， 加入会议的时候需要查找会议号。



## 用户操作流程
1. 登录
2. 创建会议或者加入会议
3. 查看会议列表
4. 参加会议
5. 结束会议


## 数据库设计




## 外观设计规则 design rules design tokens
### 设计原则 (Design Principles)
- **响应式适配**：支持 Desktop, Tablet, Mobile。移动端优先显示当前发言者，桌面端支持宫格视图。
- **国际化 (i18n)**：UI 布局需兼容中英文切换，确保长文本不溢出。
- **深色模式**：默认提供深色主题以减少视频会议时的视觉疲劳。
- **无障碍性**：符合 WCAG 标准，支持快捷键操作（如 `Cmd+D` 静音）。

### Design Tokens
- **Colors**:
  - `primary`: `#007AFF` (品牌色)
  - `success`: `#34C759` (麦克风/摄像头开启)
  - `error`: `#FF3B3

## 交互设计

---

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端框架 | React + TypeScript |
| 后端 | Node.js + TypeScript |
| 音视频 | [腾讯 TRTC Web SDK](https://trtc.io/zh/document/59649?platform=web&product=rtcengine&menulabel=coresdk) |
| 即时通讯 | [腾讯云 IM](https://trtc.io/zh/document/33999?platform=web&product=chat) |
| 对象存储 | 腾讯云 COS |
| 语音转写 | Gemini / 阿里云 ASR |
| 部署 | Google Cloud Run |
| 国际化 | 中文 + 英文 |

---

## 核心功能需求

### 会议管理

| 功能 | 说明 |
|------|------|
| 创建会议 | 支持密码保护 |
| 加入会议 | 通过会议号或邀请链接加入 |
| 预约会议 | 支持预约功能（暂无日历集成） |
| 房间容量 | 每个房间最多 100 名参与者 |
| 主持人 | 每个会议最多 4 个主持人 |


角色层级
┌─────────────────────────────────────────────────────────────────┐
│                        会议角色层级                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                     主持人 (Host)                        │  │
│   │  • 会议的创建者/拥有者                                     │  │
│   │  • 拥有全部权限                                           │  │
│   │  • 同一时间只能有一个主持人                                 │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              ▼                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                  联席主持人 (Co-Host)                     │  │
│   │  • 由主持人指定（可多个）                                   │  │
│   │  • 协助主持人管理会议                                      │  │
│   │  • 无法结束会议/指定其他联席主持人                          │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              ▼                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                   普通参会者 (Participant)                │  │
│   │  • 默认角色                                               │  │
│   │  • 权限受主持人控制                                        │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


会议室角色权限矩阵
权限/角色	👑 主持人 (host)	👥 联席主持人 (cohost)	👤 参与者 (member)
基础功能			
控制自己音频/视频	✅	✅	✅
屏幕共享	✅	✅	✅
发送聊天	✅	✅	✅
离开会议	✅	✅	✅
举手	✅	✅	✅
成员管理			
静音/取消静音成员	✅	✅	❌
关闭成员视频	✅	✅	❌
重命名成员	✅	✅	❌
移出成员	✅	✅	❌
永久封禁成员	✅	✅	❌
会议控制			
录制会议	✅	✅	❌
锁定会议	✅	✅	❌
全体静音	✅	✅	❌
管理等候室	✅	✅	❌
指定联席主持人	✅	✅	❌
专属主持人			
转让主持人	✅	❌	❌
移除联席主持人	✅	❌	❌
结束会议	✅	❌	❌
角色说明
角色	描述	数量限制
主持人	会议的所有者，拥有最高权限	1 人
联席主持人	协助主持人管理会议	多人
参与者	普通与会者	多人

主持人管控功能
┌─────────────────────────────────────────────────────────────────┐
│                      主持人管控能力                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【成员管理】                【安全控制】                         │
│  ├─ 静音/解除静音            ├─ 锁定会议                         │
│  ├─ 关闭/请求开启视频         ├─ 开启等候室                       │
│  ├─ 修改成员名称             ├─ 移出成员（可禁止再入）             │
│  ├─ 指定联席主持人           ├─ 限制屏幕共享                      │
│  └─ 转让主持人               └─ 设置会议水印                      │
│                                                                 │
│  【全体控制】                【录制管理】                         │
│  ├─ 全体静音                 ├─ 仅主持人可录制                    │
│  ├─ 入会自动静音             ├─ 授权特定成员录制                   │
│  ├─ 允许/禁止自行解除静音     └─ 云录制/本地录制                    │
│  └─ 入会提示音                                                  │
│                                                                 │
│  【聊天控制】                【共享控制】                         │
│  ├─ 禁止私聊                 ├─ 仅主持人可共享                    │
│  ├─ 禁止公开聊               ├─ 任意人可共享                      │
│  └─ 禁言特定成员             └─ 实时终止他人共享                   │

### 会议室功能

| 功能 | 说明 |
|------|------|
| 视频质量 | 高清 |
| 视频布局 | 宫格模式 |
| 屏幕共享 | ✅ |
| 会议聊天 | 使用腾讯 IM |
| 成员管理 | 主持人可管理参会者 |
| 麦克风管理 | 主持人可静音全体等 |
| 申请上台 | 大型会议模式 |
| 浮窗播放 | ✅ |
| AI 降噪 | ✅ |
| 弱网优化 | 网络条件差时减少卡顿 |
| 多终端登录 | ✅ |
| 主题切换 | 蓝、淡蓝、青蓝、红、粉等自定义主题色 |

### 录制与会议记录

| 功能 | 说明 |
|------|------|
| 会议录制 | ✅ |
| 录制存储 | 腾讯云 COS |
| 录制转写 | 录制完成后自动语音转文字 (Gemini/阿里云 ASR) |
| 会议记录 | 保存录像、转写文本、参会者列表 |

### 不需要的功能
- ❌ 实时 AI 字幕/实时转写
- ❌ 虚拟背景
- ❌ 美颜
- ❌ 用户登录/注册（当前使用硬编码测试用户）

---

## 配置信息

### 腾讯 TRTC / IM 配置
```
SDKAppId: 20032332
SecretKey: 04b10732102eee2fa5917f28f26b1ebdb39635fbda03302553e809bbed880bc8
```

### 测试用户
```
userId: atai
userSig: eJwtzF0LgjAUxvHvcq5DdiY6J3RlryZRFtatsDUOkdkaNYi*e6ZePr8H-h84FofgpS2kwAMGk36T0o2jC-Vcu5pGf6pr3bakIOWMhTwM*eDat2Q1pBhFUfewQR3d-ibiBBGlkGODTBd9iFUmjbXNPhbvWb7ZLsq8vKvKnZIz2xVrj9ZUGc6X3kzh*wOLjTA*
```

### 腾讯云 COS 配置
```
Bucket: xiaofan-1395107881
Region: ap-hongkong
SecretId: IKIDEXgdT6WjcP1Q0SluTBub8FF3e7RYYWXT
SecretKey: qX1KSTJxPfhXDhz3xlNlw0vhIk485xgE
```

---

## 测试计划

| 测试终端 | 数量 | 说明 |
|---------|------|------|
| 手机 | 2 | 移动端浏览器 |
| Chrome | 1 | PC 端 |
| Safari | 1 | PC 端 |

需要预设多个测试用户以支持多人会议测试。

---

## 响应式设计

- ✅ 电脑端
- ✅ 平板端
- ✅ 手机端

---

## 部署

- 平台：Google Cloud Run
- 区域：待定

---

## 参考文档

- [TRTC Web SDK 文档](https://trtc.io/zh/document/59649?platform=web&product=rtcengine&menulabel=coresdk)
- [腾讯云 IM 文档](https://trtc.io/zh/document/33999?platform=web&product=chat)
- [TRTC 云录制](https://cloud.tencent.com/document/product/647/73786)
云录制的api文档
https://trtc.io/zh/document/46960?product=rtcengine&menulabel=core%20sdk&platform=web
- [腾讯云 COS](https://cloud.tencent.com/product/cos)

@tencent-cloud-product-647.md

## Cos存储位置
/{SdkAppId}_{RoomId}/individual/{UserId}/{TaskId}/{FileName}
部分	您的值	说明
20032332	SdkAppId	您的 TRTC 应用 ID
992165	RoomId	房间号
individual	录制模式	单流录制（每个用户单独录制）
atai	UserId	被录制的用户 ID
D0ceVVh...	TaskId	录制任务 ID
main.mp4	文件名	主流视频
关于 individual 模式
我之前设置的是 RecordMode: 2（混流录制），但从路径看这是单流录制。这可能是因为：


房间只有一个用户 - 
当只有一个人时，默认使用单流录制
当房间有多个人的时候，点击录制的时候，调用trtc服务端api，启用混流配置

只有主持人，或者联席主持人，能开启关闭录制
其他人不显示录制按钮

## 混流录制

使用 CreateCloudRecording API 来实现合流录制（将全部视频录制到一个文件中）。
关键参数设置
在调用 CreateCloudRecording 时，需要设置以下参数来实现合流录制：
1. RecordParams 参数：
RecordMode: 设置为 2（表示合流录制模式）
StreamType: 设置为 0（表示录制音视频）
2. MixTranscodeParams 参数：
设置视频参数（分辨率、码率、帧率等）
例如：宽度 360，高度 640，帧率 15，码率 500000bps
3. MixLayoutParams 参数：
MixLayoutMode: 设置为 3（表示九宫格布局）
也可以选择其他布局模式或自定义布局
API 调用示例
JSON
复制
POST / HTTP/1.1
Host: trtc.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: CreateCloudRecording

{
    "SdkAppId": 1400188366,
    "RoomId": "3560",
    "UserId": "10001",
    "UserSig": "eJw1jcEKgkAURX9FZlvY...",
    "RecordParams": {
        "RecordMode": 2,
        "StreamType": 0,
        "MaxIdleTime": 60
    },
    "MixTranscodeParams": {
        "VideoParams": {
            "Width": 360,
            "Height": 640,
            "Fps": 15,
            "BitRate": 500000,
            "Gop": 10
        }
    },
    "MixLayoutParams": {
        "MixLayoutMode": 3
    },
    "StorageParams": {
        "CloudVod": {
            "TencentVod": {
                "ExpireTime": 0
            }
        }
    }
}
这个 API 会返回一个 TaskId，你需要保存这个任务 ID 用于后续操作（如停止录制等）