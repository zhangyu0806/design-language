# 项目 AI 指令

本项目使用个人设计语言。生成任何 UI 前，必读 `.ai/DESIGN.md`（全局 DNA + Nevers）。
方向不明确时，必读 `.ai/STYLE_PREVIEW.md`，先做 3–4 个可看的 mini mockup 让用户选方向。

## 当前 preset

本项目使用 **editorial** preset。详细规范见 `.ai/presets/editorial.md`。
（换 preset 时，把这行、下面引用、以及 `index.html` 的 `<html data-preset="...">` 一起改成对应名字。）

## 硬性要求

- 颜色只用语义变量：`var(--color-bg)` / `var(--color-surface)` / `var(--color-text)` / `var(--color-text-muted)` / `var(--color-border)` / `var(--color-accent)` / `var(--color-cta)`
- 禁止 Tailwind 默认色（`bg-blue-600` 等会构建失败）
- 圆角用分级变量，不要全员同一值
- 过渡具名属性 + `var(--ease-signature)`，禁止 `transition-all`
- 标题 weight ≤ 600，用 `type-*` composite 类
- 遵守 `.ai/DESIGN.md` 的全部 NEVERS
- 涉及 UI / 视觉 / 页面重构时，先判断任务类型与胆量档位，再给：Design read / Design risks / Preflight target
- 风格方向未定时，追加 Style preview：3–4 个方向 / 三拨盘初始值 / 是否生成 `design-previews` 预览页
- 交付前按 `.ai/DESIGN.md` 的页面级反 slop 审稿清单检查首屏、section 节奏、视觉资产、状态、文案
- 重要页面走两轮：生成 → 截图/交互实测 → 视觉/工程/业务三视角评审 → 精修
- 动效只用具名属性，默认 `var(--ease-signature)`；列表 stagger 50–70ms；hover 用 `@media (hover: hover)` 包住

## 组件

复用 `src/components/` 下的 Button / Card / Field，保持风格一致。
