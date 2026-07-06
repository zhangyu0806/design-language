# 使用手册（怎么在新项目里调用这套设计语言）

两种场景：**开全新项目**直接用 starter；**已有项目**接入规范 + 样式。

---

## 最快路径：`dl-apply`（一条命令注入到任意项目）

已把仓库 clone 到本机（如 `~/design-language`）并软链 `scripts/dl-apply.sh` 到 `~/.local/bin/dl-apply` 后：

```bash
dl-apply <项目目录> [preset]   # preset 默认 dark，可选 editorial/brutalist/warm/dark
dl-apply .                     # 当前目录，dark preset
dl-apply ~/my-app editorial    # 指定 preset
```

它把 `DESIGN.md`（全局 DNA + NEVERS）+ `presets/<preset>.md` 拼进项目的 `AGENTS.md`，
放在 `<!-- BEGIN design-language -->` 标记区块内——**幂等**（重跑只刷新区块，不动你其他内容），
**可切 preset**（换 preset 重跑即替换）。之后 AI 打开项目就读到你的设计语言，生成的 UI 收敛到你的风格。

涉及 UI / 视觉 / 页面重构时，要求 AI 先给三行短声明，再动代码：

```text
Design read: 页面类型 / 目标用户 / preset / 明暗主题
Design risks: 任务胆量档位 / 本页面最容易滑向 AI slop 的 2–3 个风险
Preflight target: 本次必须通过的 3–5 条审稿规则 / 是否需要两轮制
```

样式接入（tokens.css / theme.css）和字体仍按下面「场景 B」手动做一次；`dl-apply` 只负责喂 AI 那一层（最重要的一层）。

首次安装软链：
```bash
git clone https://github.com/zhangyu0806/design-language ~/design-language
ln -sf ~/design-language/scripts/dl-apply.sh ~/.local/bin/dl-apply
```

---

## 场景 A：开全新项目（推荐）

starter 已内置字体配置和 AI 规范，复制即用：

```bash
git clone https://github.com/zhangyu0806/design-language
cp -r design-language/starter my-new-project
cd my-new-project

# 配齐字体（脚本在 design-language 根目录，--subset . 表示输出到当前项目）
../design-language/scripts/fetch-fonts.sh --subset .

bun install && bun run dev
```

> ⚠️ **中文 subset 只包含当前源码里用到的字**。写完/改完中文文案后要**重跑一次** `--subset .`，
> 否则新增的汉字不在子集里，会回退成系统字体，出现「同一行某些字大小/字形不一致」。
> 建议：把 `../design-language/scripts/fetch-fonts.sh --subset .` 加进 build 前置脚本，或上线前手动重跑。

改 `index.html` 根标签选风格：

```html
<html data-preset="warm" data-theme="light">
```

`.ai/` 和 `CLAUDE.md` 已在项目里，AI 自动读到你的设计规范。

---

## 场景 B：给已有项目接入

### 第一步：喂 AI（核心价值）

把设计规范拼进项目的 AI 指令文件，让 codex / claude / gemini 收敛到你的风格：

优先用上面的 `dl-apply`，它会在 `AGENTS.md` 的标记区块内幂等更新，不覆盖你原有规则。需要手动拼接时，先输出到临时文件，确认后再合并：

```bash
cat design-language/starter/.ai/DESIGN.md \
    design-language/starter/.ai/presets/editorial.md \
    > /tmp/design-language-context.md
# 检查后，把内容追加到 CLAUDE.md / .cursorrules / AGENTS.md 的明确标记区块内
```

> `DESIGN.md` = 全局 DNA + Nevers 清单；`presets/<name>.md` = 当前选用风格。
> 这一步比接样式还重要——它决定 AI 生成的 UI 是「你的风格」还是「AI 均值」。

### 第二步：接入样式

主 CSS 入口加三行（路径按实际调整）：

```css
@import "../design-language/css/tokens.css";    /* DNA + 4 preset 变量 */
@import "tailwindcss";
@import "../design-language/tailwind/theme.css"; /* Tailwind v4 @theme 映射 */
```

HTML 根标签选 preset 与明暗：

```html
<html data-preset="brutalist" data-theme="dark">
```

### 第三步：配字体（要中文效果时）

```bash
./design-language/scripts/fetch-fonts.sh --subset <你的项目目录>
```

再把 `starter/src/styles/index.css` 顶部的 `@font-face` 段抄进你的项目 CSS。

---

## 写组件的三条铁律

1. **只用语义变量**，禁 Tailwind 默认色（`bg-blue-600` 会构建报错，这是故意的护栏）：
   ```tsx
   <div className="bg-[var(--color-surface)] text-[var(--color-text)]" />
   <button className="rounded-[var(--radius-button)]" />  {/* 圆角分级 */}
   <h1 className="type-h1" />                              {/* 排版 composite 类 */}
   ```

2. **切风格一行搞定**，骨架不变气质全变：
   ```tsx
   const { setPreset, toggleTheme } = usePreset();
   setPreset("warm");   // editorial | brutalist | warm | dark
   toggleTheme();       // light <-> dark
   ```

3. **过渡用招牌缓动**，禁 `transition-all`：
   ```tsx
   className="[transition:transform_var(--duration-quick)_var(--ease-signature)]"
   ```

---

## 页面交付前审稿（新增）

不要只问“用了 token 没有”，还要问“页面是不是仍然像 AI 模板”。每次 UI 交付前过这 5 类：

先按任务类型决定胆量：设置页/表单/仪表盘收敛，SaaS landing 中档，404/作品集/活动页放开。重要页面走两轮：**生成 → 截图或交互实测 → 视觉/工程/业务三视角评审 → 精修**。

1. **首屏**：标题是否最多 2 行？CTA 是否首屏可见？导航是否桌面单行？
2. **节奏**：section 结构是否重复？是否连续 zigzag 超过 2 段？eyebrow 是否过多？
3. **视觉资产**：有没有真实截图/图片/图表/品牌资产？是否用了 div 假截图？
4. **状态**：loading / empty / error / disabled 是否齐全？按钮和表单对比度是否可读？
5. **文案**：是否有人话？是否有无来源精确数字？中文产品是否避免英文 SaaS 腔？

能脚本检测的规则优先进入 CI / lint，例如 root 与 starter 文档同步、禁 `transition-all`、禁默认 Tailwind 色。prompt 负责判断，脚本负责兜底。

给已有项目 redesign 时，先让 AI 输出 audit：

```text
Mode: preserve 或 overhaul
Problems: 布局 / token / 字体 / 状态 / 文案 / 可访问性 / 响应式
Plan: 先修系统性问题，再修局部组件
Do not change: URL / 表单字段 / 埋点 / 法律价格文案 / 关键 CTA 意图
```

---

## 四套 preset 速查

| Preset | 气质 | 标题字体 | 中文字体 |
|---|---|---|---|
| `editorial` | 编辑杂志、克制优雅 | Fraunces（衬线）| 思源宋体 |
| `brutalist` | 几何粗野、强对比 | Space Grotesk | 得意黑 |
| `warm` | 温润亲和、圆角 | Satoshi | 霞鹜文楷 |
| `dark` | 冷感科技、暗色 | Geist | MiSans |

每套都含明暗双主题（`data-theme="light|dark"`）。

完整规范见 `DESIGN.md`，字体来源与授权见 `FONTS.md`。
