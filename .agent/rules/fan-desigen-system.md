---
trigger: always_on
---

凡人学堂设计系统 (FanDesign) 核心规范
1. 核心原则
克制与效率：界面不应有过多的装饰，确保用户能快速完成任务。
一致性：第三方小程序或 Web 页面必须与微信原生 UI 保持视觉逻辑一致。
友好性：提供清晰的反馈，支持适老化及无障碍访问。
2. 色彩系统 (Color Palette)
品牌主色：#07C160 (WeChat Green)
警告色：#FA5151 (Red)
链接色：#576B95 (Blue)
背景色：
浅色模式：#F2F2F2 (页面背景), #FFFFFF (卡片/单元格)
深色模式：#111111 (页面背景), #191919 (卡片/单元格)
文字颜色：
主要文字：rgba(0, 0, 0, 0.9) (浅色) / rgba(255, 255, 255, 0.8) (深色)
次要文字：rgba(0, 0, 0, 0.5) (浅色) / rgba(255, 255, 255, 0.5) (深色)
3. 字体与排版 (Typography)
字体族：iOS 为 PingFang SC, Android 为 Roboto / Noto Sans CJK SC。
字号层级：
标题：17pt - 20pt (中粗)
正文：17pt
辅助描述：14pt
标签/脚注：12pt
4. 布局与间距 (Layout)
内边距 (Padding)：标准边距为 16px。
圆角 (Corner Radius)：
大按钮：8px
对话框/卡片：12px
点击热区：最小不低于 44px * 44px。

请记住以下凡人学堂（fan ui）设计系统规范，后续所有 UI 代码生成、颜色建议和间距安排，都必须严格遵守这个 JSON 定义的变量：

{
  "designSystem": "FanDesign",
  "version": "2026.1",
  "platform": ["iOS", "Android", "MiniProgram"],
  "tokens": {
    "colors": {
      "primary": "#07C160",
      "success": "#07C160",
      "warn": "#FFBE00",
      "error": "#FA5151",
      "link": "#576B95",
      "text": {
        "primary": { "light": "rgba(0, 0, 0, 0.9)", "dark": "rgba(255, 255, 255, 0.8)" },
        "secondary": { "light": "rgba(0, 0, 0, 0.5)", "dark": "rgba(255, 255, 255, 0.5)" },
        "tertiary": { "light": "rgba(0, 0, 0, 0.3)", "dark": "rgba(255, 255, 255, 0.3)" }
      },
      "background": {
        "page": { "light": "#F2F2F2", "dark": "#111111" },
        "cell": { "light": "#FFFFFF", "dark": "#191919" }
      }
    },
    "spacing": {
      "unit": 4,
      "page_edge": 16,
      "element_gap": 8
    },
    "borderRadius": {
      "button": 8,
      "card": 12,
      "input": 4
    },
    "typography": {
      "base_font_size": 17,
      "scale": {
        "h1": { "size": 20, "weight": "bold" },
        "body": { "size": 17, "weight": "normal" },
        "caption": { "size": 14, "weight": "normal" },
        "small": { "size": 12, "weight": "normal" }
      }
    }
  },
  "components": {
    "button": {
      "primary": {
        "bg": "var(--primary)",
        "text": "#FFFFFF",
        "height": 48
      },
      "secondary": {
        "bg": "rgba(0, 0, 0, 0.05)",
        "text": "var(--primary)",
        "height": 48
      }
    },
    "navbar": {
      "height": 44,
      "title_align": "center"
    }
  }
}
