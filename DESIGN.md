# DESIGN.md — 个人设计语言规范（喂给 AI 的核心文件）

> **使用方式**：把本文件（或其压缩版）放进项目的 `CLAUDE.md` / `.cursorrules` / codex 上下文。
> 它会改变模型的输出分布，让 codex / gemini / claude 收敛到**本设计语言**，而非语料库均值（"AI slop"）。
>
> 结构：**全局 DNA（恒定不变，所有项目共享）** + **可切换 Preset（按项目情形选一套）**。
> 选定 preset 后，把对应的 `presets/<name>.md` 一并附上。

---

## 0. 最高优先级：先选姿态，再写代码

写第一行代码前，必须确认当前项目用哪个 preset：

| Preset | 适用 | 一句话气质 |
|---|---|---|
| `editorial` | SaaS / 文档 / 专业工具 | 克制、精准、可信，像 Stripe |
| `brutalist` | 开发工具 / 技术博客 / 个人项目 | 锋利、硬朗、记忆点强 |
| `warm` | C 端 / 内容社区 / 生活方式 | 亲切、温润、有人情味 |
| `dark` | AI 产品 / 作品集 / 夜间工具 | 沉浸、技术感、高级 |

切换方式：`<html data-preset="editorial">`。每个 preset 都有亮/暗两套（`data-theme="light|dark"`）。

---

## 1. 全局 NEVERS（强制禁令，违反即返工）

这些是把模型从"语料均值"掰开的核心杠杆。**任何 preset 下都不可违反。**

```
NEVER 用 Inter / system-ui 作标题字体
NEVER 用 blue-500(#3b82f6) / indigo-600(#4f46e5) 或任何 Tailwind 默认色板
NEVER 用纯白 #fff / 纯黑 #000 作大面积底色或正文色
NEVER 用 紫→粉 / 紫→靛蓝 的多段渐变
NEVER 用 glassmorphism（毛玻璃 backdrop-blur 滥用）
NEVER 用 transition-all（必须具名属性 + 具名时长 + DNA 缓动曲线）
NEVER 用 居中 hero + 三等分卡片网格 的默认布局
NEVER 在指标数字上用渐变文字
NEVER 卡片里套卡片（nested cards）
NEVER 写 "Empower your team to unlock..." 这类空话文案
NEVER 让所有间距都是 4 的倍数（按 DNA-1 故意破网格）
NEVER 让所有元素同一个圆角（按 DNA-2 分级）
NEVER 用假截图 div（假 dashboard / 假 terminal / 假任务列表）冒充真实产品视觉
NEVER 用满页小 eyebrow（每个 section 都一个小大写标签）制造模板感
NEVER 让 CTA 在桌面换行，或同一页面出现多个同义 CTA 文案
NEVER 编造精确数字（92%、4.8x、13.7ms）当装饰；没有来源就写成示例或不用
NEVER 让 loading / empty / error / disabled 状态缺席
```

---

## 2. 设计 DNA（你的指纹，所有 preset 恒定）

### DNA-1 · 间距节奏
- 基础单位 **4px**，token 见 `core.json` 的 `space.*`。
- **故意保留非网格值** `5px / 14px / 22px`（token: `space.rhythm-1/2/3`），用于关键位置打破机器般的均匀。
- 相邻区块的 padding **不要相同**，制造非等比节奏。
- 区块级留白用 `space.section-*`（较大且非等比）。

### DNA-2 · 圆角哲学（分级，不统一）
- 按元素层级递增，**绝不全员同一圆角**：
  - 按钮 `radius.button = 4px`
  - 输入框 `radius.input = 6px`
  - 卡片 `radius.card = 10px`
  - 大容器 `radius.container = 2px`
  - 全圆 `radius.full = 9999px`（仅头像/徽标/pill）
- `brutalist` preset 特化：以上全部 = `0`（合法变体）。

### DNA-3 · 动效缓动
- 招牌曲线 **`--ease-signature: cubic-bezier(0.22, 1, 0.36, 1)`**（easeOutQuint，有弹性不夸张）。
- 时长按**意图**命名，不按数字：
  - `--duration-instant: 100ms`（状态切换）
  - `--duration-quick: 180ms`（hover/press）
  - `--duration-smooth: 280ms`（位移/展开）
- **永远具名属性**：`transition: transform var(--duration-quick) var(--ease-signature), background-color var(--duration-instant) var(--ease-signature);`
- 尊重 `prefers-reduced-motion`，减弱或关闭。

### DNA-4 · 排版逻辑
- **靠字号 + 行高扛视觉重量，不靠加粗**。标题 weight **500–600**，禁止 700。
- 标题负字间距 `letter-spacing: -0.02em`；正文 `0` 或极小正值。
- 大标题用 `text-wrap: balance`。
- 排版 token 一律 **composite（组合）**：一个 token 打包 `font-family / font-size / font-weight / line-height / letter-spacing`，**禁止拆成单属性使用**。
- 字号阶梯用 `clamp()` 流式响应，减少断点 media query。

### DNA-5 · 布局
- 优先**非对称网格**：`grid-template-columns: 3fr 5fr` 之类，而非 `grid-cols-3` 三等分。
- Hero 不居中堆叠；用偏置构图、overlapping、内容破网格表达"人为选择"。
- 不同内容类型用不同卡片结构，不要一套卡片套所有。

---

## 3. 中文字体策略（重要）

每个 preset 用**中英搭配**：英文字体定气质，中文字体配合。中文全字库体积大（4–15MB），**必须处理**：

### 加载规则
1. **优先字体子集化（subset）**：只打包项目实际用到的汉字，体积可降到几十 KB。生产环境用 `fonttools` / `cn-font-split` 等做子集。
2. **`font-display: swap`**：先用系统中文字体渲染，webfont 到位后替换，避免首屏阻塞。
3. **每条中文字体都带系统 fallback 链**：
   ```
   "<webfont>", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif
   ```
   宋体类 fallback：`"Songti SC", "SimSun", serif`。

### 各 preset 字体（详见对应 presets/<name>.md）

| Preset | 英文标题 | 英文正文 | 中文标题 | 中文正文 |
|---|---|---|---|---|
| `editorial` | Fraunces (serif) | Geist | 思源宋体 Noto Serif SC | 思源黑体 Noto Sans SC |
| `brutalist` | Space Grotesk (700+) | mono / grotesk | 得意黑 Smiley Sans | 思源黑体 Medium |
| `warm` | Satoshi | humanist sans | 霞鹜文楷 LXGW WenKai | 思源黑体 |
| `dark` | Geist / grotesk | Geist | MiSans / HarmonyOS Sans SC | MiSans |

所有列出字体均免费可商用、可 webfont。

---

## 4. Token 引用纪律（三层架构）

```
Tier 1 Primitive（原始值）   --color-clay-600  --space-4   ← 仅 token 文件内部定义，组件禁用
Tier 2 Semantic（角色）      --color-accent  --color-surface  --color-text-muted  ← 组件只用这层
Tier 3 Component（组件状态） --button-bg-hover  --card-radius  ← 可选，组件用
```

- 组件代码**只准引用 Tier 2 / Tier 3**。出现 Tier 1 原始值或 `bg-blue-600` 视为违规。
- Tailwind config 已**整体替换 `colors`**（非 extend），用默认色会构建失败——这是有意的护栏。
- token 必须**穷尽状态**：每个交互元素的 default / hover / press / focus / disabled 都要有；中性灰阶 8 级；focus ring 颜色 + 透明度都要定义。

---

## 5. 页面级反 slop 审稿清单

这一节是 AI 生成 UI 后的**审稿人**。它不改变 DNA，而是防止页面虽然用了 token，仍然长得像模板。

### 5.1 首屏与导航
- Hero 必须在首屏成立：标题桌面最多 2 行，副标题最多 25 个中文词或 20 个英文词，主 CTA 首屏可见。
- Hero 文字元素最多 4 个：eyebrow / 标题 / 副标题 / CTA。信任背书、logo wall、功能 bullet 放到下一屏。
- 导航桌面必须单行，高度默认 64–72px，最高 80px。放不下就删项或收进菜单，不准挤成两行。
- CTA 文案每个意图只保留一种：`开始使用` / `立即体验` / `免费试用` 不要在同一页混用。

### 5.2 Section 节奏
- 一个页面至少 4 种 section 结构：hero、split、bento、quote、steps、pricing、faq、cta、footer 等不要重复同一种布局。
- 连续左右图文 zigzag 最多 2 段；第 3 段必须换成全宽、bento、列表、时间线或其他结构。
- 小大写 eyebrow 最多每 3 个 section 出现 1 次；不要给每段标题都贴标签。
- 长列表超过 5 项时不要继续 `ul + divide-y`，改用分组、tabs、accordion、横向 scroll-snap、卡片网格或摘要 + 展开。

### 5.3 视觉资产
- Landing / portfolio 至少需要真实视觉：产品截图、真实图片、生成图、图表或品牌资产。纯文字 + 渐变 blob 不是完成品。
- 禁止用 div 拼假产品截图。要么用真实截图，要么生成/提供图片，要么明确留 TODO 槽位。
- Logo wall 只放 logo 或可靠 wordmark，不加行业小字说明；虚构品牌要有简单 SVG mark，不能只排一排文字。

### 5.4 交互与状态
- 所有按钮、输入、卡片 hover 必须有明确状态；按钮文字对比度必须可读。
- 表单必须 label 在上、错误在下、placeholder 不能当 label。
- Loading 用骨架屏或局部状态，不用孤立 spinner 糊弄。
- Empty state 说明怎么开始；Error state 说明发生了什么和下一步；Disabled state 必须有原因或上下文。

### 5.5 文案与数字
- 页面文案读出来要像人写的，不要 fake poetic、过度谦逊、空泛愿景、英文营销腔直译。
- 中文产品默认中文表达，不要把英文 SaaS 套话翻译成中文。
- 精确数字必须有来源；没有来源时用“示例数据”“约”“可配置”或直接删掉。

---

## 6. 现有项目 Redesign Audit 协议

接已有项目时，先审稿再动手，避免把可用产品改成漂亮但坏掉的页面。

1. **判定模式**：
   - `preserve`：保留信息架构、导航、表单字段、URL、核心文案，只改善视觉与状态。
   - `overhaul`：允许重组页面，但必须说明改了哪些信息架构。
2. **先列问题**：按“布局 / token / 字体 / 状态 / 文案 / 可访问性 / 响应式”列出 5–12 个问题。
3. **先修系统性问题**：优先 token、排版层级、间距节奏、组件状态，再修单个卡片的漂亮程度。
4. **不静默改变**：URL、表单字段名、埋点属性、法律/价格/隐私文案、关键 CTA 意图，未经明确要求不要改。
5. **改后复查**：逐项跑第 5 节页面级反 slop 审稿清单。

---

## 7. AI 执行格式

让 AI 生成或改 UI 时，要求它先输出这三行，再写代码：

```text
Design read: 当前页面类型 / 目标用户 / 选用 preset / 明暗主题
Design risks: 最容易滑向 AI slop 的 2–3 个风险
Preflight target: 本次交付必须通过的 3–5 条审稿规则
```

如果是小修小补，可以压缩成一句，但不能跳过“当前 preset + 风险”。

---

## 8. 自检清单（提交前过一遍）

- [ ] 没有任何 NEVERS 清单里的东西
- [ ] 当前 preset 已通过 `data-preset` 指定
- [ ] 颜色全部来自 semantic token，无硬编码 hex、无 Tailwind 默认色
- [ ] 圆角分级（按钮/输入/卡片不同），非全员一致
- [ ] 动效具名属性 + 招牌缓动曲线，无 `transition-all`
- [ ] 标题 weight ≤ 600，靠字号行高扛重量
- [ ] 中文字体带 subset 方案 + 系统 fallback 链
- [ ] 布局非对称，hero 非居中三等分
- [ ] 页面通过第 5 节反 slop 审稿清单：首屏、section 节奏、视觉资产、状态、文案
- [ ] 如为 redesign，已按第 6 节先审稿、再修系统性问题，没有静默改变关键业务结构
- [ ] AI 输出或 PR 说明包含 Design read / Design risks / Preflight target
- [ ] 文案不是空话，读出来像人写的

---

> 完整方案与背景见 `PROPOSAL.md`。Token 源文件见 `tokens/`。各 preset 喂养片段见 `presets/`。
