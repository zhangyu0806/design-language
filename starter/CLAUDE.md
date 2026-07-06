# 项目 AI 指令

本项目使用个人设计语言。生成任何 UI 前，必读 `.ai/DESIGN.md`（全局 DNA + Nevers）。

## 当前 preset

本项目使用 **editorial** preset。详细规范见 `.ai/presets/editorial.md`。
（换 preset 时，把这行和下面引用改成对应名字。）

## 硬性要求

- 颜色只用语义变量：`var(--color-bg|surface|text|text-muted|border|accent|cta|...)`
- 禁止 Tailwind 默认色（`bg-blue-600` 等会构建失败）
- 圆角用分级变量，不要全员同一值
- 过渡具名属性 + `var(--ease-signature)`，禁止 `transition-all`
- 标题 weight ≤ 600，用 `type-*` composite 类
- 遵守 `.ai/DESIGN.md` 的全部 NEVERS
- 生成或改 UI 前先给：Design read / Design risks / Preflight target
- 交付前按 `.ai/DESIGN.md` 的页面级反 slop 审稿清单检查首屏、section 节奏、视觉资产、状态、文案

## 组件

复用 `src/components/` 下的 Button / Card / Field，保持风格一致。
