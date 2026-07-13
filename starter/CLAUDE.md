# 项目 AI 指令

本项目使用个人设计语言。生成任何 UI 前，必读 `.ai/DESIGN.md`（全局 DNA + Nevers）。
方向不明确时，必读 `.ai/STYLE_PREVIEW.md`，先做 3–4 个可看的 mini mockup 让用户选方向。

按任务条件加载可选参考，不要默认全读：

- 复杂组件、表单流程、状态恢复或安全退出：读取 `.ai/references/UI_PATTERNS.md`（`ui-patterns`）。
- 转场、展开、拖拽、列表变化或 reduced motion：读取 `.ai/references/MOTION.md`（`motion`）。
- 图表、指标、趋势、比较或数据口径：读取 `.ai/references/DATA_VIS.md`（`data-vis`）。
- 记录用户已确认、需跨任务复用的项目偏好：读取 `.ai/references/PREFERENCES.md`（`preferences`），实际记录写入项目根目录 `DESIGN_PREFERENCES.md`。

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
- 涉及 UI / 视觉 / 页面重构时，先判断任务类型与胆量档位，再给：Design read / Functional contract / Design risks / Preflight target / Modules
- `Functional contract` 概括页面为何存在、用户 3 秒内必须知道什么和必须完成什么动作；`Modules` 列出本次实际加载的模块 ID，没有则写“无”
- 风格方向未定时，追加 Style preview：3–4 个方向 / 三拨盘初始值 / 是否生成 `design-previews` 预览页
- `design-previews` 必须产出跨平台、静态、自包含 HTML，以 `file:` 直接打开是默认路径
- 可选预览选择服务不在 starter 内，也不会被复制或由 `dl-apply` 启动；需要持久化选择时，只能在 Linux/WSL2、Node.js 22 和功能正常的 `/proc/self/fd` 环境中，从 design-language checkout 显式调用 `node ~/design-language/scripts/dl-preview-cli.mjs --port 0 [--exit-on-select] <preview-dir>`
- 持久服务固定 `127.0.0.1`，不得增加 host、CORS、tunnel、proxy、daemon、watch、自动打开、`sudo` 或公网暴露用法；精确 manifest/DOM、malformed 零副作用、HTTP `204`、session、`0600` 原子输出、关闭预算和临时文件例外均以 `.ai/STYLE_PREVIEW.md` 为准
- 交付前按 `.ai/DESIGN.md` 的页面级反 slop 审稿清单检查首屏、section 节奏、视觉资产、状态、文案
- 重要页面走两轮：生成 → 截图/交互实测 → 视觉/工程/业务三视角评审 → 精修
- 基础动效只用具名属性和本地 token；需要专项动效决策时加载 `.ai/references/MOTION.md`

## 组件

复用 `src/components/` 下的 Button / Card / Field，保持风格一致。
