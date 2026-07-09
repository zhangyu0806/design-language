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

### 0.1 先判任务类型，再决定胆量

同一套 DNA 不能用同一档胆量打所有任务。写 UI 前先把任务归到一档：

| 类型 | 例子 | 胆量 | 纪律 |
|---|---|---:|---:|
| 约束型产品页 | 设置页、表单、仪表盘、支付、管理后台 | 4/10 | 9/10 |
| 常规品牌页 | SaaS landing、功能介绍、价格页、文档首页 | 6/10 | 8/10 |
| 开放创意页 | 404、作品集、活动页、个人主页、campaign | 8/10 | 7/10 |

- 胆量 = 构图、色块、字体对比、视觉隐喻的冒险程度。
- 纪律 = 可访问性、状态完整、信息架构、真实内容不可破坏的强度。
- 约束型页面宁可克制，也不要牺牲可用性；开放型页面必须有一个强记忆点，但仍然不能违反 NEVERS。

### 0.2 三拨盘：把“更大胆 / 更稳 / 更密”变成可调参数

需要探索视觉方向时，除 preset 外再声明三个拨盘。它们是执行参数，不替代功能契约：

| 拨盘 | 低值 | 高值 | 默认推断 |
|---|---|---|---|
| 视觉冒险度 | 对称、保守、可预期 | 非对称、强记忆点、概念化 | 功能页 4–5，品牌页 6–7，开放创意页 8–9 |
| 动效强度 | 几乎静态 | 有编排、有转场、有反馈层次 | 表单/设置 3–4，landing 5–6，作品集/活动页 6–8 |
| 信息密度 | 留白多、少控件 | 高密度、强数据、驾驶舱感 | 内容页 3–4，SaaS 4–5，仪表盘 6–7 |

- 对用户展示时必须用中文解释，不要只写 `VARIANCE / MOTION / DENSITY`。
- 用户说“更稳一点 / 更大胆 / 动效少一点 / 信息更密”时，先更新三拨盘，再继续设计。
- 任何拨盘值都不能豁免业务可用性、状态完整、可访问性和 NEVERS。

### 0.3 风格试衣间：方向不明确时先看后选

当任务是新项目视觉定调、品牌页、landing、作品集、活动页、或用户要求“给几个方向看看”时，先做轻量风格预览，再正式实现：

1. 给出 3–4 个方向，每个方向必须有互斥约束（字体轴 / 明暗轴 / 布局轴 / 密度轴至少不同两项）。
2. 每个方向做一个真实 mini mockup：真字体、真颜色、真布局、真实文案；禁止只给色板、字体名或文字描述。
3. 预览文件放在浅层目录：`design-previews/YYYY-MM-DD-任务名/index.html`；这是方向样机，不是最终页面。
4. 预览页外壳保持中性一致，方向差异只发生在 mockup 内；按钮文案清楚写 `选择 A/B/C/D · 方向名`。
5. 其中一个方向可标注“推荐”，但不能把推荐态当作用户已选择；必须等用户明确选择或授权默认方向。

不适用：用户已指定唯一明确风格、纯 bugfix、纯组件状态修复、或已有生产页面只做小范围 polish。

---

## 1. 全局 NEVERS（强制禁令，违反即返工）

这些是把模型从"语料均值"掰开的核心杠杆。**任何 preset 下都不可违反。**

### 规则优先级

当规则看似冲突时，按这个顺序判断：**用户明确要求 > Redesign Audit 不可静默改变项 > 业务信息与可用性 > 全局 DNA / NEVERS > 当前 preset 指纹 > 装饰细节**。

当前合法例外只有这些：`brutalist` 可以使用纯白/近黑高对比、0 圆角、display 字体的粗重字形；但依然不能用 Tailwind 默认蓝、紫渐变、毛玻璃、空话文案、假截图等 AI slop。

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

### 5.0 两阶段 / 两轮制

不要一边生成一边自我说服。按两阶段做：

1. **自由创作阶段**：根据第 0.1 节任务类型选择胆量，先做一个成立的版本。
2. **独立审计阶段**：像另一个 reviewer 一样，按本节清单逐项找问题，必须指出取舍，不要只说“已优化”。

重要页面至少做两轮：**生成 → 截图/交互实测 → 三视角评审 → 精修**。

三视角评审：
- **视觉视角**：是否有记忆点？是否仍像默认模板？
- **工程视角**：是否有状态、focus、reduced-motion、响应式、可维护 token？
- **业务视角**：是否保住真实内容、CTA 意图、转化路径和用户下一步？

方向未定的页面先走风格试衣间：看 3–4 个 mini mockup 后再选方向，不要只靠文字描述决定美术风格。

### 5.1 首屏与导航
- Hero 必须在首屏成立：标题桌面建议最多 2 行，副标题最多 25 个中文词或 20 个英文词，主 CTA 首屏可见。
- Hero 文字元素最多 4 个：eyebrow / 标题 / 副标题 / CTA。信任背书、logo wall、功能 bullet 放到下一屏。
- 导航桌面必须单行，高度默认 64–72px，最高 80px。放不下就删项或收进菜单，不准挤成两行。
- CTA 文案每个意图只保留一种：`开始使用` / `立即体验` / `免费试用` 不要在同一页混用。移动端允许布局重排，但主次动作必须清晰。

### 5.2 Section 节奏
- 长 landing / portfolio 建议至少 4 种 section 结构：hero、split、bento、quote、steps、pricing、faq、cta、footer 等不要重复同一种布局。设置页、登录页、表单页、组件页、小工具页不强制。
- 连续左右图文 zigzag 最多 2 段；第 3 段必须换成全宽、bento、列表、时间线或其他结构。
- 小大写 eyebrow 最多每 3 个 section 出现 1 次；不要用无信息量的小标签 / pill / badge / overline 堆叠制造层次。
- 长列表超过 5 项时不要继续 `ul + divide-y`，改用分组、tabs、accordion、横向 scroll-snap、卡片网格或摘要 + 展开。

### 5.3 视觉资产
- Landing / portfolio 至少需要真实视觉：产品截图、真实图片、生成图、图表或品牌资产。纯文字 + 渐变 blob 不是完成品。
- 禁止用 div 拼假产品截图。要么用真实截图，要么生成/提供图片，要么明确留 TODO 槽位。
- Logo wall 只放 logo 或可靠 wordmark，不加行业小字说明；虚构品牌要有简单 SVG mark，不能只排一排文字。

### 5.4 交互与状态
- 所有按钮、输入、卡片 hover 必须有明确状态；按钮文字对比度必须可读。
- 表单必须 label 在上、错误在下、placeholder 不能当 label。
- 异步区域 / 数据区块 / 表单流程必须考虑 Loading / Empty / Error / Disabled；纯静态展示不强制。
- Loading 用骨架屏或局部状态，不用孤立 spinner 糊弄；Empty state 说明怎么开始；Error state 说明发生了什么和下一步；Disabled state 必须有原因或上下文。
- 复杂交互必须考虑 Esc 关闭、焦点返还、aria-live 播报、键盘可达；危险操作确认框不能只有视觉弹窗。

### 5.5 文案与数字
- 页面文案读出来要像人写的，不要 fake poetic、过度谦逊、空泛愿景、英文营销腔直译。
- 中文产品默认中文表达，不要把英文 SaaS 套话翻译成中文。
- 精确数字必须有来源；没有来源时用“示例数据”“约”“可配置”或直接删掉。
- 借鉴参考产品时必须写清具体来源和可复用值：例如阴影、间距、按钮形态、动效曲线；禁止只写“参考某某的高级感”。

### 5.6 可脚本检测优先

能写成脚本的规则，不要只靠 prompt 里的“自觉”：

- 禁用 `transition-all` / 默认 Tailwind 色 / Inter 标题 / 未同步 root 与 starter 副本。
- 检查 `DESIGN.md` 与 `starter/.ai/DESIGN.md`、`presets/*.md` 与 `starter/.ai/presets/*.md` 是否一致。
- 后续可把更多 NEVERS 做成 lint / CI 检测；文档规则负责判断，脚本规则负责兜底。

### 5.7 用户偏好账本

设计过程里一旦用户给出可复用偏好（例如“不要斜体”“预览说明太多”“按钮必须明显”），要沉淀到项目 AI 指令或团队规范里，而不是只修当次页面。

建议格式：

```text
偏好: 一句话规则
级别: 硬禁令 / 强偏好 / 情境规则
适用: 哪类页面或组件
原话: 用户怎么说的
动作: 已同步到哪些文件或检查清单
```

与本设计语言冲突时，用户明确偏好优先；但不能覆盖安全、可访问性、真实业务信息和法律/价格/隐私文案。

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

涉及 UI / 视觉 / 页面重构时，要求 AI 先输出这三行，再写代码：

```text
Design read: 当前页面类型 / 目标用户 / 选用 preset / 明暗主题
Design risks: 任务胆量档位 / 最容易滑向 AI slop 的 2–3 个风险
Preflight target: 本次交付必须通过的 3–5 条审稿规则 / 是否需要两轮制
```

如果方向不明确或用户要看多个风格，再补一行：

```text
Style preview: 3–4 个方向 / 三拨盘初始值 / 是否需要 design-previews 预览页
```

非 UI 小改可以压缩成一句“不涉及视觉规则变更”，但不能在 UI 任务里跳过“当前 preset + 风险”。

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
- [ ] 方向不明确时，已提供可看的风格试衣间或说明为什么不需要
- [ ] 文案不是空话，读出来像人写的

---

> 完整方案与背景见 `PROPOSAL.md`。Token 源文件见 `tokens/`。各 preset 喂养片段见 `presets/`。
