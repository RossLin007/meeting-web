Critical/High Findings

  - 房间状态“多主”与竞态：IM 自定义事件 + Socket 状态 + TRTC 远端用户并行驱动 UI，缺乏单一权威源，导致成员/媒体状态不一致（视频缺失、昵称丢失、刷新才恢
    复）。src/pages/Meeting.tsx:177 src/pages/Meeting.tsx:202 src/hooks/useRoomState.ts:1 src/hooks/useSocket.ts:1
  - 远端视频订阅存在竞态：TRTC 事件里用 document.getElementById 订阅一次性流，UI 又按 socketMembers 过滤渲染，DOM 未挂载时订阅丢失。src/hooks/
    useTRTC.ts:78 src/pages/Meeting.tsx:353 src/pages/Meeting.tsx:604
  - 录制配置逻辑有硬伤：recordMode 实际未切换；StreamType 仅音频；订阅名单默认仅发起者，直接导致多用户录制缺失/布局异常。server/src/services/
    recording.ts:101 server/src/services/recording.ts:133 server/src/routes/recording.ts:24 src/hooks/useRecording.ts:83
  - 加入流程串行阻塞：IM 登录/加群完成后才启动本地音视频，导致“打开音频/视频慢”。src/pages/Meeting.tsx:316 src/pages/Meeting.tsx:326

  Medium/Low Findings

  - 用户名请求在请求前标记为已获取，失败后不会重试，导致昵称长期缺失。src/pages/Meeting.tsx:382
  - 退出会议未调用 IM logout，只退群，导致“IM 未退出”报错。src/hooks/useMeetingHandlers.ts:166 src/hooks/useIM.ts:171 src/services/im.ts:492
  - 设备选择 UI 未落地到 TRTC（仅设置本地 state），多浏览器同机麦克风冲突时无法切换设备。src/components/meeting/SettingsModal.tsx:144
  - 说话人高亮/麦克风动态图标/每人网络信号未接入数据源，仅有 UI 预留。src/components/meeting/VideoGrid.tsx:37 src/components/meeting/TopBar.tsx:11 src/
    pages/Meeting.tsx:574
  - 录制操作缺少“starting/stopping”状态机，长链路交互时缺乏反馈。src/hooks/useRecording.ts:70

  Architecture-Level Solution Proposal

  - 单一控制面：以 Socket 为会议状态唯一权威（成员/角色/媒体/录制/等待室），IM 仅负责聊天；移除或只读化 IM 的房间状态广播。
  - 引入 MeetingSession 状态机：集中管理 TRTC/Socket/IM 的 join/leave/reconnect；音视频与录制操作进入 pending 状态并带超时回滚，UI 直接反馈。
  - 远端流管理下沉：用 ref 注册表实现“DOM 挂载即订阅，卸载即退订”，并对 TRTC 的远端可用事件做重试/补偿，消除 DOM 竞态。
  - 录制统一协调器（后端）：按人数动态选择单流/混流，强制 StreamType=0；维护订阅名单并在成员变更时更新；通过 Socket 广播录制状态。
  - 设备管理闭环：将 Settings 的设备选择应用到 TRTC SDK；同机多浏览器冲突时给出明确错误与替代路径（选择不同设备/禁用麦克风）。
  - 说话人/网络质量：接入 TRTC 音量/统计事件，做平滑与阈值判断，驱动高亮、动态图标和每人信号显示。

  Open Questions

  - 是否可以将 Socket 设为唯一会议状态源（IM 仅聊天），还是必须保留 IM 状态广播？
  - 录制布局的业务规则：固定九宫格还是“主讲人+自适应”？以及是否需要多路单流备份？
  - 多浏览器同机使用是否是必须支持的场景？如果是，需要明确 UX 提示与限制策略。
  - 会议结束后的期望行为：仅断开会话还是需要彻底 IM 登出并清理本地缓存？

  Change Summary

  - 已完成代码审计与问题归因，定位到“状态多源 + 订阅竞态 + 录制配置”三类根因。
  - 给出可落地的架构级整改方案与关键链路设计，不包含代码变更。

  Next Steps

  1. 你确认“Socket 为唯一会议状态源 + IM 仅聊天”的方向与录制布局规则。
  2. 我可以基于确认方向输出详细实施方案（模块拆分、里程碑、验收用例）。
  3. 审核通过后再开始开发。


› 1. 确认 Socket 为唯一会议状态源 + IM 仅聊天
  2. 录制布局的业务规则：固定九宫格
  3. 多浏览器同机使用 不是必须支持的场景!
  4. 结束会议,彻底 IM 登出并清理本地缓存. 离开会议, 仅断开会话. 是两种不同的方式.


  Scope

  - 会议状态：Socket 唯一权威源；IM 仅聊天。
  - 录制布局：固定九宫格。
  - 不支持同机多浏览器场景（不做适配）。
  - 结束会议：IM 登出 + 清缓存；离开会议：仅断会话。

  Design Proposal

  - 统一状态源
      - 会议成员/媒体/录制/等待室状态：全部来自 Socket。
      - IM 的 room_state 自定义事件不再用于状态同步，仅聊天消息。
  - 会话状态机
      - MeetingSession: idle → joining → joined → leaving → ended
      - 将音视频/录制操作纳入 pending 状态，UI 立即反馈，失败回滚。
  - 远端视频订阅重构
      - 用 ref 注册表：DOM mount 自动订阅、unmount 自动退订；避免 getElementById 一次性订阅丢失。
  - 录制固定九宫格
      - 后端强制 RecordMode=2 + MixLayoutMode=3，并设置 3x3 Grid 参数。
      - 维护订阅名单：从 Socket 会议成员推送到录制任务，成员变更时调用 ModifyCloudRecording。
  - 离开 vs 结束
      - leave: 退出 TRTC + 退群 IM + 保留本地缓存（聊天本地记录保留）。
      - end: 退出 TRTC + 退群 IM + IM logout + 清理本地缓存（messages/localStorage）。

  Planned Changes (files)

  - 会议页面状态源收敛：src/pages/Meeting.tsx
  - 远端订阅：src/hooks/useTRTC.ts + 新增 src/hooks/useRemoteVideo.ts
  - IM 仅聊天：src/hooks/useRoomState.ts、src/services/im.ts（保留聊天，移除状态广播）
  - 结束会议/离开会议流程：src/hooks/useMeetingHandlers.ts
  - 录制后端固定九宫格：server/src/services/recording.ts、server/src/routes/recording.ts
  - 录制状态机与 UI：src/hooks/useRecording.ts、src/components/meeting/RecordingControl.tsx

  Acceptance

  - 多人进入后不再出现用户 C 无画面、昵称缺失、需刷新等问题。
  - 录制稳定九宫格（多人场景），不再只录单人。
  - “结束会议”彻底退出 IM 并清缓存，“离开会议”仅断会话。
  - 录制/音视频按钮有“处理中”状态。

  如果你认可这个方案，我就按这个方案开始开发。

  商业级一般会做“权威状态 + 版本化事件 + 客户端自愈 + 共享存储”的组合，而不是只靠事件广播。核心目标是：任何端出现偏差，都能在几十秒内自动自愈。

  推荐标准做法（实用版）：

  - 权威状态服务：服务端维护会议状态（成员、角色、视频开关、等候室等），这仍是唯一真相。
  - 共享存储：用 Redis（或数据库+缓存）存房间状态，支持多实例和崩溃恢复。
  - 版本/序列号：每次状态变更带 stateVersion / eventSeq，客户端缺序就拉快照。
  - 快照 + 事件流：事件实时推送，每 30–60 秒广播一次 room:state 快照（或者客户端主动拉）。
  - 客户端自检：客户端定期比对 Socket状态 与 TRTC远端用户，发现缺失就重订阅/请求快照。
  - 客户端上报：客户端上报自身媒体状态（publish/subscribe 结果），服务端比对后可发送“纠正指令”。