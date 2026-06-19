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

## 5. 自检清单（提交前过一遍）

- [ ] 没有任何 NEVERS 清单里的东西
- [ ] 当前 preset 已通过 `data-preset` 指定
- [ ] 颜色全部来自 semantic token，无硬编码 hex、无 Tailwind 默认色
- [ ] 圆角分级（按钮/输入/卡片不同），非全员一致
- [ ] 动效具名属性 + 招牌缓动曲线，无 `transition-all`
- [ ] 标题 weight ≤ 600，靠字号行高扛重量
- [ ] 中文字体带 subset 方案 + 系统 fallback 链
- [ ] 布局非对称，hero 非居中三等分
- [ ] 文案不是空话，读出来像人写的

---

> 完整方案与背景见 `PROPOSAL.md`。Token 源文件见 `tokens/`。各 preset 喂养片段见 `presets/`。
