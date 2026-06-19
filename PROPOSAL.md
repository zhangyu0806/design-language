# 个人设计语言方案 · 共享 DNA + 多 Preset 架构（待定稿）

> 目标：建立一套**属于你自己的、可复用**的设计语言。丢给 codex / gemini / claude 任意一家，输出都收敛到**你的风格**，而不是语料库均值（"AI slop"）。
>
> 技术栈：React + Tailwind。
> 本文档只做**方案设计**，不写代码。你定稿后，我再落地成 token 文件 + DESIGN.md。

---

## 核心理念：你要的不是"一套风格"，是"一套系统"

如果只做 4 套互相独立的风格，那不叫"你的设计语言"——换个人也能用，没辨识度。

真正的个人设计语言 = **一条贯穿所有项目的 DNA + 按情形切换的表层 preset**。

```
┌─ 你的设计 DNA（所有 preset 共享，这是"你的指纹"）──────────────┐
│  无论项目长什么样，这些东西恒定不变，行家一看就知道"同一个人做的" │
│   · 间距节奏        · 圆角哲学        · 动效缓动曲线              │
│   · 排版逻辑        · 全局 Nevers 清单                          │
├──────────────────────────────────────────────────────────────┤
│  可切换的「Preset 姿态包」（按项目情形调用，只换表层）            │
│   editorial  →  SaaS / 文档 / 专业工具                          │
│   brutalist  →  开发者工具 / 技术博客 / 个人项目                  │
│   warm       →  C 端 / 内容社区 / 生活方式                       │
│   dark       →  AI 产品 / 作品集 / 夜间工具                      │
└──────────────────────────────────────────────────────────────┘
```

**结果：** 你做 5 个项目可以呈现 5 种表观，但间距节奏、圆角哲学、动效手感始终一致——这就是辨识度的来源。

---

## 一、为什么 AI 生成的 UI 都长一样（病因）

**分布性收敛（distributional convergence）**：LLM 不审美，只预测"下一个最可能的 token"。训练语料里 UI 代码绝大多数是 Tailwind 文档、shadcn 模板、Vercel 风格落地页。**一百万个网站的平均值，就是一个无聊网站。**

典型 AI 指纹：

| 维度 | AI 默认（slop） |
|---|---|
| 字体 | Inter / system-ui（~73%） |
| 主色 | `blue-500` / `indigo-600` |
| 背景 | 纯白 / `slate-50` |
| 圆角 | `rounded-lg` (8px) 全员一致 |
| 阴影 | 卡片 `shadow-md` |
| 动画 | `transition-all duration-300 ease-in-out`（全场景同一条） |
| 间距 | 全是 4 的倍数 |
| 布局 | 居中 hero + 三等分卡片网格 |
| Hero | 紫→靛蓝渐变 + 居中白字 |
| 文案 | "Empower your team to..." 空话 |

**让模型"更有创意"是没用的**（prompt cope）。模型没品味，只有概率分布。
**唯一有效解法：生成开始前，用结构化 token + nevers 清单覆盖默认值，从而改变分布本身。** 这正是 Anthropic frontend-design Skill 的做法。

---

## 二、三层 Token 架构（技术骨架）

```
Tier 1 Primitive（原始值，无语义）   例: --color-clay-600  --space-4
        ↓ 被引用
Tier 2 Semantic（角色，组件只能用这层）例: --color-accent  --color-surface  --color-text-muted
        ↓ 被引用
Tier 3 Component（组件级状态，可选）  例: --button-bg-hover  --card-radius
```

**铁律：**
- 组件代码只准引用 Tier 2/3，绝不出现 Tier 1 原始值或 `bg-blue-600`。
- **关键反制：Tailwind config 里直接整体替换 `colors`（而非 extend）**，让 `bg-indigo-600` 构建直接失败。强制失败正是目的，逼模型和你只能用自定义色板。
- **token 要穷尽到每个状态**（hover/press/focus/disabled、8 级中性灰阶、focus ring 透明度…），否则模型会用语料均值填满缝隙。

### DNA 和 Preset 分别落在哪一层？

| 层 | 归属 | 说明 |
|---|---|---|
| **间距 / 圆角 scale / 动效曲线 / 排版 scale** | **DNA（共享）** | Tier 1 的"尺度"部分 + Tier 2 语义，所有 preset 引用同一套 |
| **颜色 / 字体家族 / 阴影质感 / 纹理** | **Preset（可切换）** | 每个 preset 覆盖这部分 Tier 1 primitive |
| **组件如何组合 token** | **DNA（共享）** | Button/Card 结构和状态逻辑固定，只是吃不同 preset 的色值 |

> 借鉴 SCALES 的 X-tier 模型：`scaling/factors`（全局尺度，品牌无关）+ `brand/[x]/*`（品牌专属原语）+ `alias/*`（对外公共 API）。我们的 DNA = scaling + alias 逻辑，preset = brand 层。

---

## 三、你的设计 DNA（所有 Preset 共享 —— 需要你确认）

这是"你的指纹"。以下是我建议的一套 DNA，你可以逐条调整：

### DNA-1 间距节奏
- 基础单位 **4px**，但**故意在关键处插入非网格值**（5 / 14 / 22px）制造人为节奏感。
- 区块之间用**非等比间距**（相邻区块 padding 不相同），打破机器的均匀感。

### DNA-2 圆角哲学
- **不统一圆角**：按元素层级递增 —— 按钮 4px / 输入框 6px / 卡片 10px / 容器 2px。
- 这条是强辨识特征：大多数 AI/项目都全员同一圆角，你故意分级。
- （brutalist preset 会把这条特化为"全 0"，属 DNA 在该 preset 下的合法变体）

### DNA-3 动效缓动
- 招牌缓动曲线 **`cubic-bezier(0.22, 1, 0.36, 1)`**（easeOutQuint，有弹性但不夸张）。
- **禁止 `transition-all`**：永远具名属性 + 具名时长（如 `transition: transform 180ms, background-color 120ms`）。
- 时长按"意图"命名：`instant 100ms` / `quick 180ms` / `smooth 280ms`，不按数字。

### DNA-4 排版逻辑
- **靠字号 + 行高扛视觉重量，不靠加粗**。标题用 weight 500–600，不用 700。
- 标题加**负字间距**（`letter-spacing: -0.02em`），正文略正。
- 大标题用 `text-wrap: balance`。
- 排版 token 一律是 **composite（组合）**：一个 token 打包 字体/字号/字重/行高/字间距，禁止拆成单属性。

### DNA-5 全局 Nevers（所有 preset 强制执行）
```
NEVER Inter / system-ui 作标题字体
NEVER blue-500 / indigo-600 或任何 Tailwind 默认色板
NEVER 纯白 #fff / 纯黑 #000 大面积底色或正文色
NEVER 紫→粉 / 紫→靛蓝多段渐变
NEVER glassmorphism 毛玻璃
NEVER transition-all（要具名、分属性、用 DNA 缓动）
NEVER 居中 hero + 三等分卡片网格的默认布局
NEVER 指标数字用渐变文字
NEVER 卡片套卡片
NEVER "Empower your team to..." 空话文案
NEVER 间距全部是 4 的倍数（按 DNA-1 故意破网格）
```

---

## 四、四套 Preset（表层，按情形调用）

每套只覆盖**颜色 / 字体家族 / 阴影质感 / 纹理**，间距/圆角/动效/排版逻辑全部继承 DNA。
颜色用 **OKLCH**（明度感知均匀，适合生成阶梯）。

### 🅐 `editorial` — 编辑感（SaaS / 文档 / 专业工具）
| | |
|---|---|
| 主色 | 深墨蓝偏冷 `oklch(0.45 0.08 250)` |
| CTA 辅色 | 暖赭橙 `oklch(0.68 0.15 55)` |
| 背景 | 暖白 `oklch(0.99 0.005 90)` |
| 正文 | 墨黑偏暖 `oklch(0.25 0.01 60)` |
| 字体 | 标题 **Fraunces**(serif) / 正文 **Geist** |
| 阴影 | 极淡，主要靠边框和对比 |
| 气质 | 克制、精准、可信，像 Stripe / 高级杂志 |

### 🅑 `brutalist` — 极简硬朗（开发工具 / 技术博客 / 个人项目）
| | |
|---|---|
| 主色 | 高饱和单色：电光黄 `oklch(0.85 0.18 100)` 或正红 `oklch(0.55 0.22 25)` |
| 背景 | 纯白或纯黑（对比拉满） |
| 正文 | 近纯黑 `oklch(0.15 0 0)` |
| 字体 | 标题 **Space Grotesk / Archivo**(超粗) / 正文 等宽或 grotesk |
| 圆角 | **0（DNA-2 在此特化为全直角）** |
| 阴影 | **硬边偏移阴影** `4px 4px 0 #000`（无 blur） |
| 气质 | 锋利、自信、记忆点强，撞脸风险极低 |

### 🅒 `warm` — 温暖人文（C 端 / 内容社区 / 生活方式）
| | |
|---|---|
| 主色 | 陶土橙 `oklch(0.62 0.14 50)`（彻底告别蓝） |
| 辅色 | 鼠尾草绿 `oklch(0.68 0.06 145)` |
| 背景 | 奶油米白 `oklch(0.97 0.015 85)` |
| 正文 | 暖深棕灰 `oklch(0.30 0.02 60)` |
| 字体 | 标题 **Satoshi / Fraunces** / 正文 humanist sans |
| 阴影 | 暖调柔影（阴影掺一点棕，不是纯灰） |
| 气质 | 亲切、温润、有人情味，反企业蓝 |

### 🅓 `dark` — 暗色氛围（AI 产品 / 作品集 / 夜间工具）
| | |
|---|---|
| 主色 | 单一发光色：青绿 `oklch(0.80 0.15 175)` 或琥珀 `oklch(0.78 0.14 75)` |
| 背景 | 深蓝灰近黑 `oklch(0.18 0.02 250)` |
| 正文 | 米白偏暖 off-white `oklch(0.92 0.01 85)` |
| 字体 | 标题 **Geist**/grotesk / 代码 Geist Mono |
| 阴影 | 用**发光 glow**代替投影（强调色低透明度光晕） |
| 氛围 | **放弃多段渐变**，改用「深底 + 角落径向光晕」或「4–6% 噪点纹理」 |
| 气质 | 沉浸、技术感、高级 |

---

## 五、调用方式（React/Tailwind 落地形态）

### 运行时切换（同一套代码，换 preset）
```html
<html data-preset="editorial">   <!-- 或 brutalist / warm / dark -->
```
- 共享 DNA token 在 `:root` 永远生效。
- 每个 preset 在 `[data-preset="xxx"]` 下覆盖颜色/字体/阴影变量。
- 新项目只需选一个 preset，或自定义新 preset。

### 喂给 AI 时（核心价值）
- 一份**全局 `DESIGN.md`**（含 DNA + nevers）—— 每个项目都带上。
- 每个 preset 一段**专属片段**（颜色表 + 字体 + 气质参考点）—— 按项目追加。
- 丢进 `CLAUDE.md` / `.cursorrules` / codex 上下文后，三家模型的"最可能输出"不再是语料均值，而是**你的品牌 + 当前 preset**。

---

## 六、最终交付物（定稿后产出）

```
design-language/
├── DESIGN.md                  # 核心：全局 DNA + nevers，喂给所有 AI
├── tokens/
│   ├── core.json              # 共享 DNA：间距/圆角scale/动效/排版（DTCG 格式）
│   ├── preset-editorial.json  # 表层覆盖：颜色/字体/阴影
│   ├── preset-brutalist.json
│   ├── preset-warm.json
│   └── preset-dark.json
├── presets/
│   ├── editorial.md           # 每个 preset 的 AI 喂养片段 + 参考点
│   ├── brutalist.md
│   ├── warm.md
│   └── dark.md
├── css/
│   └── tokens.css             # 全部 token 编译为 CSS 变量，含 data-preset 切换
└── tailwind/
    └── theme.ts               # Tailwind @theme：整体替换 colors，映射 semantic token
```

---

## 七、需要你拍板的

1. **DNA 五条**（第三节）认可吗？尤其：
   - DNA-2 圆角分级（按钮4/输入6/卡片10/容器2）—— 接受还是想改数值？
   - DNA-3 招牌缓动 `cubic-bezier(0.22,1,0.36,1)` —— 用这个还是你有偏好？
2. **Preset 数量**：就这 4 套，还是要增/减/改？（比如再加一套"科技蓝但不是 Tailwind 蓝"的企业向？）
3. **明暗模式**：每个 preset 都配套暗色变体，还是 `dark` preset 专门负责暗色、其余只做亮色？
4. **字体**：接受推荐的免费字体（Fraunces/Geist/Satoshi/Space Grotesk），还是有指定字体？

定稿后，我按第六节产出全部文件。
