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

```bash
cat design-language/starter/.ai/DESIGN.md \
    design-language/starter/.ai/presets/editorial.md \
    > my-project/CLAUDE.md      # 或 .cursorrules / AGENTS.md
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

## 四套 preset 速查

| Preset | 气质 | 标题字体 | 中文字体 |
|---|---|---|---|
| `editorial` | 编辑杂志、克制优雅 | Fraunces（衬线）| 思源宋体 |
| `brutalist` | 几何粗野、强对比 | Space Grotesk | 得意黑 |
| `warm` | 温润亲和、圆角 | Satoshi | 霞鹜文楷 |
| `dark` | 冷感科技、暗色 | Geist | MiSans |

每套都含明暗双主题（`data-theme="light|dark"`）。

完整规范见 `DESIGN.md`，字体来源与授权见 `FONTS.md`。
