# 工具脚本

## 可选预览选择 CLI

`dl-preview-cli.mjs` 是 Linux/WSL2、Node.js 22 零依赖工具，为符合根目录 `STYLE_PREVIEW.md` 契约的静态预览增加可持久化选择。跨平台 `file:` 静态、自包含 HTML 仍是默认；`dl-apply` 不复制或启动此工具。持久 CLI 还要求功能正常的 `/proc/self/fd`，并在访问用户预览根目录、监听、清理或写入前验证它；失败只输出私有 `PREVIEW_START_FAILED`。

```bash
node ~/design-language/scripts/dl-preview-cli.mjs --port 0 [--exit-on-select] <preview-dir>
```

`--port` 接受 `0..65535`，默认 `0`。`--exit-on-select` 会在第一个合法选择写入后退出；不加时服务持续运行，允许后续选择替换结果。服务固定监听 `127.0.0.1`，stdout ready JSON 提供精确 `url`、端口、输出文件名和当前 session。结果用 `0600` 同目录临时文件原子替换 `<preview-dir>/selection.json`，消费前必须核对文件 session 与本次 ready session。客户端只有收到精确 HTTP `204` 并完整消费响应后才显示成功。

不要使用 `sudo`、host 改写、CORS、反向代理、tunnel、proxy、daemon、watch、自动打开或任何公共端口转发。CLI 不提供这些能力，也不应被包装成公网服务。选择按 FIFO 写入；close 拒绝新工作，force fence 后未开始工作和 rename 都不得启动。SIGINT/SIGTERM 给 4 秒优雅期，第 5 秒是绝对外层截止时间。极端不可中断文件系统调用可能留下严格命名的 `0600` 临时文件，下次有效启动会尽力清理，不承诺无条件清理。真实且固定为 `144.0.7559.109` 的 Chrome E2E 与阻塞信号测试只属于本地标准测试和 CI，不增加运行时依赖。生产实现是七个不超过 250 纯 LOC 的模块。完整 HTML 契约、静态回退和安全边界见 `STYLE_PREVIEW.md`，面向人的完整流程见 `USAGE.md`。

## 中文字体 subset 脚本

中文 webfont 全字库 4–15MB，直接加载严重拖慢首屏。这两个脚本把它压到可用体积。
**已实测**：8MB 思源黑体 → 精确模式 36K / 分包模式按需加载。

## 一次性准备（装 fonttools）

```bash
cd design-language
python3 -m venv .venv
.venv/bin/pip install fonttools brotli
```

脚本会自动用 `.venv` 里的 fonttools，没有则回退系统 `python3`/`pyftsubset`。

---

## 模式一：精确 subset（固定文案的小站）

扫描项目源码提取**实际用到的汉字**，一次性压到最小。体积最小，但文案变了要重跑。

```bash
./scripts/subset-exact.sh <字体文件> <要扫描的源码目录> [输出.woff2]

# 例：从 demo 目录扫描用字，subset 思源黑体
./scripts/subset-exact.sh fonts/NotoSansSC-Regular.otf demo fonts/dist/noto.subset.woff2
# => 8.0M -> 36K
```

产物是单个 woff2。在 CSS 手写 `@font-face` 指向它：

```css
@font-face {
  font-family: "Noto Sans SC";
  src: url("./fonts/dist/noto.subset.woff2") format("woff2");
  font-display: swap;
}
```

扫描的文件类型：`.html .vue .jsx .tsx .js .ts .md .json .txt .css`，并自动补常用中文标点。

---

## 模式二：分包 subset（动态内容，推荐 web）

按 unicode-range 把字体切成多个 woff2 分包（Google Fonts 同款思路），
浏览器**只下载页面用到的那几包**。无需预知用哪些字，适合 CMS / 用户生成内容。

```bash
./scripts/subset-split.sh <字体文件> [输出目录] [字体族名] [字重]

# 例：
./scripts/subset-split.sh fonts/NotoSansSC-Regular.otf fonts/dist/noto-sans-sc "Noto Sans SC" 400
# => 61 个 woff2 分包 + result.css
```

产物含 `result.css`（每包一条带 `unicode-range` 的 `@font-face`）。直接引入：

```css
@import "./fonts/dist/noto-sans-sc/result.css";
```

可选参数 `--chunk`（每包字数，默认 500）在 `split_font.py` 里调。

---

## 怎么选

| 场景 | 用哪个 |
|---|---|
| 落地页 / 文档站 / 文案基本固定 | 精确（模式一），体积最小 |
| 博客 / CMS / 用户输入 / 文案常变 | 分包（模式二），按需加载 |

## 各 preset 的中文字体去哪下

| 字体 | 来源 |
|---|---|
| 思源黑体 Noto Sans SC | github.com/notofonts/noto-cjk |
| 思源宋体 Noto Serif SC | github.com/notofonts/noto-cjk |
| 霞鹜文楷 LXGW WenKai | github.com/lxgw/LxgwWenKai |
| 得意黑 Smiley Sans | github.com/atelier-anchor/smiley-sans |
| MiSans | hyperos.mi.com/font |

下载 `.otf`/`.ttf` 放进 `fonts/`，按上面命令 subset 即可。
