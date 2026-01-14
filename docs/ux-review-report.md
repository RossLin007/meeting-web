# 用户体验 (UX) 审查报告
## 智会 (ZhiHui Meeting) - 会议应用

**日期:** 2026-01-12
**审查视角:** 最终用户
**审查范围:** 首页、会议界面、交互流程

---

## 执行摘要

从用户视角来看，智会应用整体 UI 设计简洁清晰，功能分区合理，支持中英文双语切换。但在**错误反馈**、**加载状态**、**操作提示**和**移动端适配**方面存在明显体验问题。

**总体评分:** 6.5/10

| 维度 | 评分 | 状态 |
|------|------|------|
| 视觉设计 | 8/10 | 良好 |
| 交互流程 | 7/10 | 尚可 |
| 反馈提示 | 4/10 | 需改进 |
| 错误处理 | 5/10 | 需改进 |
| 无障碍访问 | 3/10 | 严重不足 |
| 移动端适配 | 未知 | 未测试 |

---

## 1. 首页体验

### 1.1 积极发现

**视觉清晰:**
- 左侧视频预览区布局合理
- 控制按钮图标清晰，带有文字标签
- 支持摄像头预览功能

**操作便捷:**
- 三个主要操作（新建会议、加入会议、预约会议）入口明显
- 摄像头/麦克风开关有直观的图标状态变化

**双语支持:**
- 完整的中英文翻译
- 语言切换即时生效

---

### 1.2 体验问题

#### 问题 1: 摄像头错误静默失败
**位置:** `Home.tsx:156-159`

```typescript
.catch((err) => {
    console.error('Failed to get camera:', err);
    setCameraOn(false);
})
```

**用户影响:** 用户点击摄像头开关后没有任何提示，不知道为何无法开启摄像头

**建议改进:**
```typescript
.catch((err) => {
    if (err.name === 'NotAllowedError') {
        showToast('摄像头权限被拒绝，请在浏览器设置中允许访问', 'error');
    } else if (err.name === 'NotFoundError') {
        showToast('未检测到摄像头设备', 'error');
    } else {
        showToast('无法开启摄像头，请检查设备连接', 'error');
    }
    setCameraOn(false);
})
```

---

#### 问题 2: 创建会议时缺少加载反馈
**位置:** `Home.tsx:170-204`

```typescript
const handleCreateMeeting = async () => {
    setIsCreating(true);
    // ... API 调用没有明确的加载状态展示给用户
```

**用户影响:** 点击"创建会议"后，界面没有明显的加载指示，用户不知道是否在处理

**建议:** 添加明确的加载状态提示，如旋转图标或进度条

---

#### 问题 3: 访客用户 ID 显示不友好
**位置:** `store.ts:16`

```typescript
userId: 'guest_' + Math.random().toString(36).substring(7)
```

**用户影响:** 未登录用户看到的 ID 是类似 `guest_x3k9j2m` 的随机字符串，体验不专业

**建议:** 显示更友好的临时名称，如"访客 1234"或允许用户自定义昵称

---

#### 问题 3: 会议列表为空时的提示不够引导
**位置:** `Home.tsx:316-319`

```typescript
{meetingList.length === 0 ? (
    <div className={styles.emptyList}>
        <p>{t('home.noMeetings')}</p>
    </div>
) : ...}
```

**用户影响:** 新用户看到"暂无会议"不知道下一步该做什么

**建议:** 添加引导文案，如"点击上方「新建会议」开始您的第一次会议"

---

## 2. 会议界面体验

### 2.1 积极发现

**工具栏设计:**
- 控制按钮分组合理（左侧媒体控制、中间功能、右侧结束会议）
- 图标 + 文字标签的组合降低认知负担
- 聊天未读消息徽章设计实用

**聊天功能:**
- 支持常用表情快捷选择
- 消息气泡区分发送者和接收者
- 时间戳格式友好（今天显示时间，昨天显示"昨天"）

**布局选择:**
- 5 种布局模式有可视化图标预览
- 每种布局有文字说明

---

### 2.2 体验问题

#### 问题 4: 录制权限提示不明确
**位置:** `Toolbar.tsx:263-269`

```typescript
disabled={!canRecord}
title={isRecording || isRoomRecording
    ? t('recording.stop')
    : canRecord
        ? t('recording.start')
        : t('recording.noPermission')  // 仅在 title 中显示
}
```

**用户影响:** 非主持人看到的录制按钮是灰色的，鼠标悬停才能看到"无权限录制"，不直观

**建议:** 按钮应该显示文字标签"仅主持人可录制"，而不是仅依赖 tooltip

---

#### 问题 5: 结束会议弹窗文案可能引起恐慌
**位置:** `EndMeetingModal.tsx:32-34`

```typescript
<p className={styles.message}>
    {isHost ? t('endMeeting.hostMessage') : t('endMeeting.message')}
</p>
```

**当前文案:**
- 主持人: "作为主持人，您可以选择结束会议或仅离开。"
- 参会者: "您确定要离开会议吗？"

**用户影响:** "结束会议"一词可能让用户担心会误操作关闭所有人的会议

**建议:**
- 主持人选项改为 "结束所有人会议"（更明确）
- 参会者文案改为 "您要离开当前会议吗？"（更温和）

---

#### 问题 6: 成员面板操作菜单无确认
**位置:** `MemberPanel.tsx:275-296`

```typescript
<button onClick={() => {
    member.isMuted ? onUnmuteMember?.(member.userId) : onMuteMember?.(member.userId);
    setActiveMenu(null);
}}>
```

**用户影响:** 主持人点击"静音"、"关闭视频"等操作后立即生效，没有确认提示，容易误操作

**建议:** 对敏感操作（如静音、移出会议）添加确认对话框

---

#### 问题 7: 设备选择不生效
**位置:** `SettingsModal.tsx:145-174`

```typescript
<select
    className={styles.select}
    value={selectedMic}
    onChange={(e) => setSelectedMic(e.target.value)}
>
```

**用户影响:** 用户在设置中选择不同的麦克风/摄像头，但实际上设备并没有切换

**问题原因:** 代码只是保存了选择状态，但没有实际调用 TRTC SDK 切换设备

**建议:** 需要实现实际的设备切换逻辑，或者移除这个功能模块直到实现完成

---

#### 问题 8: 邀请链接复制没有持久化反馈
**位置:** `InviteModal.tsx:38-46`

```typescript
const handleCopyLink = useCallback(async () => {
    try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);  // 2秒后恢复
    } catch (error) {
        console.error('Failed to copy:', error);  // 错误仅打印到控制台
    }
}, [inviteLink]);
```

**用户影响:** 复制失败时用户不知道（如浏览器不支持 clipboard API）

**建议:** 添加降级方案和错误提示：
```typescript
try {
    await navigator.clipboard.writeText(inviteLink);
    showToast('已复制到剪贴板', 'success');
} catch (error) {
    // 降级到传统复制方法
    const textArea = document.createElement('textarea');
    textArea.value = inviteLink;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('已复制到剪贴板', 'success');
    } catch {
        showToast('复制失败，请手动复制', 'error');
    }
    document.body.removeChild(textArea);
}
```

---

## 3. 交互流程问题

### 3.1 首次使用流程

#### 问题 9: 缺少新用户引导
**观察:** 首次打开应用没有任何引导或教程

**用户影响:** 新用户不知道：
- 如何开始第一次会议
- 各个功能的作用
- 是否需要登录

**建议:** 添加首次使用引导，可以是：
- 简单的分步教程
- 关键功能的气泡提示
- 演示视频

---

### 3.2 会议加入流程

#### 问题 10: 加入会议缺少输入验证
**位置:** `Home.tsx:208-217`

```typescript
const handleJoinMeeting = () => {
    if (!roomIdToJoin) return;  // 仅检查空值
    // 没有验证会议号格式、是否为数字等
```

**用户影响:** 用户输入错误的会议号（如字母、长度不对）只有在进入会议后才报错

**建议:** 添加实时验证：
```typescript
// 6位数字验证
const isValidRoomId = /^\d{6}$/.test(roomIdToJoin);

if (!isValidRoomId) {
    showToast('请输入正确的6位会议号', 'error');
    return;
}
```

---

#### 问题 11: URL 参数暴露会议密码
**位置:** `Home.tsx:200`

```typescript
navigate(`/meeting/${roomId}?userId=${...}&password=${meetingPassword}`);
```

**用户影响:** 会议密码明文显示在 URL 中，会被：
- 浏览器历史记录保存
- 服务器访问日志记录
- 分享链接时无意中泄露

**建议:** 密码不应放在 URL 中，应在进入会议后验证

---

### 3.3 会议中断恢复

#### 问题 12: 刷新页面后状态丢失
**观察:** 在会议中刷新页面，需要重新加入会议

**用户影响:** 意外刷新导致需要重新操作，体验差

**建议:** 实现自动重连机制，刷新后自动尝试重新加入会议

---

## 4. 无障碍访问 (严重不足)

### 4.1 键盘导航

#### 问题 13: 按钮缺少键盘焦点样式
**影响:** 键盘用户无法识别当前焦点位置

**建议:** 所有可交互元素需要添加 `:focus` 样式

---

### 4.2 屏幕阅读器支持

#### 问题 14: 图标按钮缺少 aria-label
**位置:** 多处

```typescript
<button onClick={onToggleMic}>
    <MicIcon />  <!-- 缺少替代文本 -->
</button>
```

**建议:**
```typescript
<button onClick={onToggleMic} aria-label={isMicOn ? '关闭麦克风' : '开启麦克风'}>
    <MicIcon />
</button>
```

---

#### 问题 15: 状态变化没有 aria-live 区域
**影响:** 屏幕阅读器用户无法获知：
- 聊天消息到达
- 成员加入/离开
- 录制状态变化

**建议:** 添加 aria-live 区域通报重要状态变化

---

### 4.3 色彩对比度

#### 问题 16: 禁用按钮对比度不足
**位置:** `Toolbar.tsx:269`

```typescript
disabled={!canRecord}  // 禁用状态可能不够明显
```

**建议:** 确保禁用状态的颜色对比度符合 WCAG AA 标准（4.5:1）

---

## 5. 移动端体验 (未测试)

**建议:** 需要进行移动端实际测试，重点检查：
- 小屏幕上的工具栏布局
- 触摸操作的目标大小（至少 44x44px）
- 横竖屏切换适配
- 虚拟键盘弹出的影响

---

## 6. 国际化问题

### 6.1 积极发现

- 完整的中英文翻译覆盖
- 日期格式本地化（今天/昨天）
- 数字格式可能需要本地化

---

### 6.2 改进建议

#### 问题 17: 表情符号可能在不同系统显示不同
**位置:** `SettingsModal.tsx:94-100`

```typescript
🇨🇳 中文
🇺🇸 English
```

**影响:** 某些 Windows 系统可能无法正确显示国旗 emoji

**建议:** 使用文本代替或同时提供文本和 emoji

---

## 7. 性能感知问题

### 7.1 加载时间

#### 问题 18: 首屏加载缺少骨架屏
**影响:** 用户看到白屏时间较长

**建议:** 添加骨架屏提升感知加载速度

---

### 7.2 动画反馈

#### 问题 19: 状态切换缺少过渡动画
**观察:** 按钮、面板切换都是瞬间完成

**建议:** 添加适度的过渡动画让交互更流畅

---

## 8. 优先改进建议

### 高优先级 (影响核心体验)

1. **添加全局 Toast 提示系统** - 解决所有错误/成功反馈问题
2. **实现设备切换实际功能** - 或暂时隐藏该功能
3. **添加输入验证** - 会议号格式验证
4. **URL 参数安全性改进** - 移除密码暴露

---

### 中优先级 (提升体验质量)

5. **添加加载状态指示器**
6. **新用户引导教程**
7. **成员操作确认对话框**
8. **刷新后自动重连**

---

### 低优先级 (锦上添花)

9. **无障碍访问改进**
10. **过渡动画优化**
11. **骨架屏加载**
12. **移动端适配检查**

---

## 9. 用户测试建议

建议进行以下用户测试以验证改进效果：

### 场景 1: 新用户首次使用
- 任务: 创建并开始第一次会议
- 观察: 是否能顺利完成、是否有困惑点

### 场景 2: 加入会议
- 任务: 使用会议号加入已有会议
- 观察: 错误处理是否友好

### 场景 3: 会议中控
- 任务: 主持人管理参会者（静音、移出等）
- 观察: 操作是否直观、是否有误操作风险

### 场景 4: 网络中断
- 任务: 模拟网络断开后恢复
- 观察: 应用行为是否符合预期

---

## 10. 结论

智会应用在视觉设计和基础功能上表现良好，但在**用户反馈**和**错误处理**方面存在明显不足。最紧迫的改进需求是：

1. 建立统一的 Toast 提示系统
2. 改进所有错误场景的用户提示
3. 添加输入验证和操作确认
4. 实现承诺的功能（如设备切换）

通过这些改进，预计可将用户体验评分从 **6.5/10 提升至 8.5/10**。

---

**报告生成时间:** 2026-01-12
**审查员:** Claude Code AI (UX 视角)
