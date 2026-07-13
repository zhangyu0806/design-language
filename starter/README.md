# Design Language Starter

接好个人设计语言的 React + Tailwind v4 脚手架。**复制本目录即可开新项目**，四套 preset + 明暗双主题开箱即用。

## 技术栈

Vite 6 · React 19 · TypeScript · Tailwind CSS v4

## 快速开始

```bash
# 1. 配齐字体（首次必跑，字体不进仓库——见下方「中文字体」）
cd ..                                      # 回到 design-language/ 根目录
./scripts/fetch-fonts.sh --subset starter  # 下载全部字体 + 切中文 subset
cd starter

# 2. 跑项目
bun install
bun run dev      # 开发
bun run build    # 构建（含 tsc 类型检查）
bun run preview  # 预览构建产物
```

> 没跑第 1 步也能起，但中英文字体会回退到系统默认，看不到真实设计效果。

## 目录

```
starter/
├── .ai/                      # ★ 喂给 AI 的设计规范与审稿门禁
│   ├── DESIGN.md             #   全局 DNA + nevers + 反 slop 审稿 + redesign 协议
│   ├── STYLE_PREVIEW.md      #   风格试衣间：方向未定时先看 mini mockup 再选
│   ├── presets/*.md          #   各 preset 喂养片段 + 页面指纹/禁忌
│   └── references/           #   按任务加载的可选模块
│       ├── UI_PATTERNS.md    #   ui-patterns
│       ├── MOTION.md         #   motion
│       ├── DATA_VIS.md       #   data-vis
│       └── PREFERENCES.md    #   preferences
├── index.html                # data-preset / data-theme 初始值在 <html>
├── public/
│   └── fonts/                # 自托管字体：英文 woff2（进仓库）+ 中文 subset（脚本生成，不进仓库）
└── src/
    ├── styles/
    │   ├── tokens.css        # 设计 token（DNA + 4 套 preset，CSS 变量）
    │   ├── theme.css         # Tailwind @theme 映射（整体替换默认色板）
    │   └── index.css         # 入口，import 顺序：tokens → tailwindcss → theme
    ├── hooks/
    │   └── usePreset.ts      # preset/theme 切换 + localStorage 持久化
    ├── components/
    │   ├── Button.tsx        # primary / cta / ghost
    │   ├── Card.tsx
    │   └── Field.tsx
    ├── App.tsx               # 展示页（带 preset 切换器）
    └── main.tsx
```

## 怎么用这套设计语言

### 切换 preset / 明暗
```tsx
const { preset, setPreset, theme, toggleTheme } = usePreset();
setPreset("brutalist");  // editorial | brutalist | warm | dark
toggleTheme();           // light <-> dark（自动存 localStorage）
```

### 写组件只用语义变量
```tsx
// 颜色：语义变量，禁止 Tailwind 默认色（bg-blue-600 会报错）
<div className="bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]" />

// 圆角：分级变量
<button className="rounded-[var(--radius-button)]" />  // 按钮 4 / 输入 6 / 卡片 10

// 排版：composite 类
<h1 className="type-h1" />  <p className="type-body" />

// 过渡：招牌缓动，禁止 transition-all
className="[transition:transform_var(--duration-quick)_var(--ease-signature)]"
```

### 间距（DNA-1）
- Tailwind 默认 4px 网格保留（`p-4` `gap-3` `mb-14` 正常用）—— 这就是 DNA-1 的基础。
- 额外提供破网格 rhythm：`p-r1`(5px) `p-r2`(14px) `p-r3`(22px)
- 区块留白：`mb-section-sm/md/lg`

## 喂给 AI

新项目的默认指导由 `.ai/DESIGN.md`、静态 `.ai/STYLE_PREVIEW.md` 和当前 `.ai/presets/<name>.md` 组成。生成 UI 时必读核心与 preset，方向不明确时再读 `STYLE_PREVIEW.md`。只有任务需要时，才额外读取 `.ai/references/` 中的 `ui-patterns`、`motion`、`data-vis` 或 `preferences` 对应文件。`preferences` 的实际记录写入项目根目录 `DESIGN_PREFERENCES.md`，不写进会被刷新替换的设计语言受管区块。
这样 codex / gemini / claude 的输出会收敛到你的设计语言，而非 AI slop。

starter 只携带静态文件，不包含或捆绑 `dl-apply` 与预览选择服务，复制 starter 时也不会带走这些工具。`design-previews` 始终以跨平台 `file:` 静态、自包含 HTML 为默认，可直接打开。

如需把选择写入 `selection.json`，必须另有 design-language checkout，并从 checkout 调用：

```bash
node ~/design-language/scripts/dl-preview-cli.mjs --port 0 [--exit-on-select] <preview-dir>
```

不要从复制后的 starter 猜测脚本路径，也不要让 `dl-apply` 启动服务。持久 CLI 仅支持 Linux/WSL2、Node.js 22 和功能正常的 `/proc/self/fd`，固定监听 `127.0.0.1`，没有 host、CORS、tunnel、proxy、daemon、watch、自动打开或 `sudo` 用法。它在访问用户预览根目录、监听、清理或写入前验证平台前置条件，失败只给私有启动错误。完整 manifest/DOM 契约、精确 `204`、session、`0600` 原子输出、关闭预算和临时文件剩余风险见 `.ai/STYLE_PREVIEW.md`。

方向不明确时，再让 AI 读取 `.ai/STYLE_PREVIEW.md`，先在 `design-previews/YYYY-MM-DD-任务名/index.html` 做 3–4 个真实 mini mockup，并用中文三拨盘（视觉冒险度 / 动效强度 / 信息密度）让用户先看后选。

涉及 UI / 视觉 / 页面重构时，先让 AI 输出执行声明，再动代码：

```text
Design read: 当前页面类型 / 目标用户 / 选用 preset / 明暗主题
Functional contract: 页面为何存在 / 用户 3 秒内必须知道什么 / 必须完成什么动作
Design risks: 任务胆量档位 / 最容易滑向 AI slop 的 2–3 个风险
Preflight target: 本次必须通过的 3–5 条审稿规则 / 是否需要两轮制
Modules: 本次按需加载的模块 ID；没有则写“无”
Style preview: 方向未定时给 3–4 个方向 / 三拨盘初始值 / 是否需要 design-previews 预览页
```

胆量档位：设置页/表单/仪表盘用低胆量高纪律；SaaS landing 用中档；404/作品集/活动页可以提高视觉冒险度，但不能违反 NEVERS。

交付前按 `.ai/DESIGN.md` 的页面级反 slop 审稿清单检查：

- 首屏是否成立：标题、副标题、CTA、导航没有堆满。
- Section 节奏是否有变化：长 landing 不重复同一种左右图文/卡片布局。
- 视觉资产是否真实：不用彩色渐变框冒充截图或产品图。
- 状态是否完整：异步区域、数据区块、表单流程考虑 loading / empty / error / disabled。
- 文案与数字是否可信：不编造精确数字，不堆同义 CTA，不用无信息量标签制造层次。

如果是在改已有项目，先做 Redesign Audit：输出 `Mode / Problems / Plan / Do not change`，明确哪些信息架构、品牌资产、真实内容不能静默改变。

## 动效工艺默认值

基础动效继续遵守 `.ai/DESIGN.md` 的具名属性、时长 token、招牌曲线与 reduced motion 约束。涉及转场、展开、拖拽、列表变化或复杂反馈时，再读取可选模块 `.ai/references/MOTION.md`，不要把它默认塞进所有任务。

## 换风格

改 `index.html` 里 `<html data-preset="..." data-theme="...">`，或运行时用 `setPreset`。
如果也更新 AI 指令，记得同步 `CLAUDE.md` 里的当前 preset 和 `.ai/presets/<name>.md` 引用。
要加新 preset：在 `tokens.css` 加一段 `[data-preset="xxx"]` 覆盖颜色/字体/阴影即可，DNA 自动继承。

## 中文字体（已自托管 + subset）

字体全部自托管在 `public/fonts/`，`@font-face` 内联在 `src/styles/index.css`。
英文字体（Geist / Satoshi / 得意黑）已切片提交进仓库（每个 <1.1M）；
中文字体体积大（几 MB~24M），**不进仓库**，由脚本下载 + subset 生成。

各 preset 中文字体映射：

| Preset | 标题 | 中文 |
|---|---|---|
| editorial | Fraunces | 思源宋体 Noto Serif SC |
| brutalist | Space Grotesk | 得意黑 Smiley Sans |
| warm | Satoshi | 霞鹜文楷 LXGW WenKai |
| dark | Geist | MiSans |

### 配齐字体（clone 后跑一次）

```bash
# 在上级 design-language/ 目录运行
./scripts/fetch-fonts.sh                  # 下英文字体（进 public）+ 中文原始字体（进 fonts/）
./scripts/fetch-fonts.sh --subset starter # 扫 starter 实际用字，把中文字体切成 ~150-330K 的 woff2
```

中文 subset 文件缺失时浏览器自动回退系统中文字体（PingFang / 微软雅黑），不报错。
MiSans 来自社区镜像；正式商用建议从小米官网 https://hyperos.mi.com/font 重新下官方版替换。
