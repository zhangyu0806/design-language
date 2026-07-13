# STYLE_PREVIEW.md — 风格试衣间轻量协议

本文件用于把“先看后选”的机制接入新 UI 项目：方向不明确时，不靠文字描述争论风格，先产出 3–4 个可看的 mini mockup，再选择正式实现方向。静态、自包含 HTML 始终是默认；需要把选择交给后续 agent 时，可从 design-language checkout 显式启动本机选择服务。

## 何时使用

- 新产品视觉定调、官网 / landing、作品集、活动页、品牌页。
- 用户说“给几个方向看看”“我不确定风格”“这个页面 AI 味太重”。
- Redesign 需要在“保守修 / 结构重塑 / 理想方案”之间做选择。

不适用：明确指定唯一风格的小改、纯 bugfix、纯表单状态修复、已有页面只做局部 polish。

## 输出目录

默认在当前项目根目录创建浅层目录：

```text
design-previews/YYYY-MM-DD-任务名/index.html
```

要求：

- `index.html` 自包含，跨平台直接通过 `file:` 打开即可看；必要资产放同目录或子目录，不用隐藏目录。
- 默认不启动服务、文件监听器或后台进程。可选服务只记录选择，不修改目标应用、starter、依赖或锁文件，`dl-apply` 也不会复制或启动它。
- 预览页明确说明：这是设计方向样机，不是最终 App / 最终页面。
- 最终生产代码仍写入项目源码；预览目录只用于方向选择、截图、分享和复盘。

## HTML 明示契约

生成的 `index.html` 必须恰好包含一个活动、DOM 等价的 manifest，各层不加未知字段：

```html
<script id="dl-preview-manifest" type="application/json">
{
  "schemaVersion": 1,
  "directions": [
    {"id": "a", "label": "编辑秩序", "recommended": true},
    {"id": "b", "label": "温润叙事", "recommended": false},
    {"id": "c", "label": "几何张力", "recommended": false}
  ],
  "dials": {"variance": 50, "motion": 50, "density": 50}
}
</script>
```

`directions` 只能有 3 或 4 项。`id` 必须唯一并匹配 `^[a-z][a-z0-9-]{0,31}$`；`label` 去除首尾空白后为 1 至 80 个 Unicode 字符；`recommended` 为布尔值，且恰好一个方向为 `true`。三个拨盘值必须是 0 至 100 的整数。

只有 HTML namespace 中、解析活动且不在 `<template>` 惰性子树内的真实 manifest script 才是候选。注释、`template`、`script/style/textarea/title/xmp/iframe/noembed/noframes/plaintext` 等 raw-text 或 RCDATA 内容、SVG/MathML 等外来命名空间，以及 malformed 标签、属性、引号、注释、结束边界或多候选里的伪 manifest 都必须拒绝。不能用正则、模板文本或普通字符串搜索代替 DOM 等价发现。

页面还必须明示以下节点，bootstrap 只能按这些 ID 和属性绑定，不得根据类名、文案、标签顺序、卡片结构或视觉位置猜测：

```html
<main data-dl-preview>
  <button type="button" data-dl-choice="a" aria-pressed="false">选择 A · 编辑秩序</button>
  <button type="button" data-dl-choice="b" aria-pressed="false">选择 B · 温润叙事</button>
  <button type="button" data-dl-choice="c" aria-pressed="false">选择 C · 几何张力</button>

  <textarea data-dl-feedback maxlength="2000"></textarea>
  <input type="range" min="0" max="100" step="1" value="50" data-dl-dial="variance">
  <input type="range" min="0" max="100" step="1" value="50" data-dl-dial="motion">
  <input type="range" min="0" max="100" step="1" value="50" data-dl-dial="density">
  <p data-dl-status aria-live="polite"></p>
</main>
```

节点数量必须精确：一个 `[data-dl-preview]` 根；每个 direction 恰好一个对应 choice，不能多也不能少；一个 textarea；三个不同拨盘；一个状态区域。拨盘初值必须与 manifest 相同。

## bootstrap 行为

生成的 HTML 必须内联客户端 bootstrap，但不要把仓库里的大型 `PREVIEW_BOOTSTRAP` 常量复制进本协议。实现行为必须与以下契约一致：

1. 先严格解析唯一 manifest，验证字段、方向、拨盘和全部明示 DOM。manifest 为 `null`、字段类型错误或其他 malformed 客户端数据时，不抛异常、不 fetch、不注册任何监听器。只有存在唯一合法的 `[data-dl-status][aria-live="polite"]` 节点时，才把它精确设为 `预览配置无效`；节点缺失、重复或不合法时不猜测替代节点。
2. `file:` 和所有非官方服务环境都按静态模式工作。点击方向只更新各按钮的 `aria-pressed` 和中文状态，不发出 fetch、XHR、WebSocket 或 beacon，也不声称选择已保存。
3. 只有 `location.protocol === "http:"` 且 `location.hostname === "127.0.0.1"` 时，才同源请求相对路径 `GET /__dl/session`。合法响应必须只含 `schemaVersion: 1` 和 43 字符 base64url `session`。
4. 获得 session 后，点击 choice 才向相对路径 `POST /__dl/select` 发送 `application/json`：`schemaVersion`、`session`、`choice`、反馈框首尾去空白后的 `feedback`，以及三个当前整数拨盘值。保存成功只接受精确 HTTP `204`，并且必须完整消费该 response 后才能显示成功；其他状态包括其他 2xx 都算失败。
5. session、网络、校验或 API 失败时保留样机和用户输入，只显示通用中文提示。不得展示响应原文、绝对路径、stack、session、请求体或反馈。

`localhost`、其他 hostname、HTTPS 和其他协议必须回退到静态模式。

## 可选本机选择服务

服务工具只存在于 design-language checkout，仅支持 Linux/WSL2、Node.js 22 和功能正常的 `/proc/self/fd`。先在可信预览目录生成符合上述契约的 `index.html`，再显式运行：

```bash
node ~/design-language/scripts/dl-preview-cli.mjs --port 0 [--exit-on-select] <preview-dir>
```

方括号表示可选参数，实际命令不要保留方括号。CLI 在访问或 `realpath` 用户预览根目录、解析 manifest、监听、清理或写入前验证 Linux 与 `/proc/self/fd`。不支持的平台、探针失败和其他启动失败只输出 `{"event":"error","code":"PREVIEW_START_FAILED"}`，不暴露平台、路径或底层错误。`--port 0` 让系统分配空闲端口；不加 `--exit-on-select` 时服务持续运行，后续成功选择会替换前一次结果；加上后只接受第一个成功候选，写入后退出。stdout 成功时只输出一行 ready JSON：

```json
{"event":"ready","url":"http://127.0.0.1:43123/","host":"127.0.0.1","port":43123,"output":"selection.json","session":"<43-char-base64url>"}
```

用浏览器打开 `url`，不要把它改成 `localhost`。成功选择会在 `<preview-dir>/selection.json` 以同目录临时文件和 rename 原子替换 UTF-8 JSON，临时文件与结果权限均为 `0600`，字段固定为：

```json
{
  "schemaVersion": 1,
  "session": "<43-char-base64url>",
  "choice": "a",
  "directionLabel": "编辑秩序",
  "feedback": "用户可选反馈",
  "dials": {"variance": 50, "motion": 50, "density": 50},
  "selectedAt": "2026-07-13T12:34:56.789Z"
}
```

后续 agent 读取结果时，必须确认 `selection.json.session` 与本次 ready JSON 的 `session` 完全一致。旧文件可以留在目录中，但 session 不一致就是过期结果，不能用于当前实现。

### 静态回退与安全边界

- 不需要持久化选择时，直接打开 `index.html`，无需服务。服务停止或删除后，HTML 仍按静态模式工作。
- 服务固定监听 `127.0.0.1`，没有 host、CORS、tunnel、proxy、daemon、watch、自动打开或公共分享选项。不要配合 `sudo`、反向代理、端口转发或公网转发使用。
- 服务会校验精确 Host 与 Origin，限制请求体，并禁止通过静态路由读取 `selection.json`、临时选择文件、dotfile 和 `.openspec.yaml`。
- 信任边界是当前用户拥有的可信预览目录。它不防御同一用户权限下的恶意本地进程，也不承诺未执行目录 fsync 时的断电持久性。

### FIFO、关闭预算与临时文件

- 选择存储按完成校验的顺序进入单进程 FIFO。close 原子拒绝新工作并排空已排队工作；force fence 后，未开始的队列工作不得启动，后续文件阶段和 rename 也不得开始。
- SIGINT/SIGTERM 从同一关闭起点计时。前 4 秒用于优雅排空，第 4 秒进入 force，第 5 秒是包含 force 与清理在内的绝对外层截止时间，任何阶段都不会重置预算。
- 临时文件严格命名为 `.selection.json.<24位十六进制>.<24位十六进制>.tmp`，创建即为 `0600`。正常失败和关闭会尽力清理；极端不可中断文件系统调用可能在绝对截止时留下这种严格命名的 `0600` 临时文件。下次通过平台探针的有效启动会在读取 manifest 或监听前按严格名称尽力清理，但不承诺故障文件系统上的无条件清理。

### 验证与运行时边界

仓库的本地标准测试入口与 CI 会运行真实、固定为 `144.0.7559.109` 的 Chrome E2E，以及可控阻塞写入的 SIGINT/SIGTERM 回归。测试覆盖静态 `file:`、服务模式、malformed 数据零副作用、精确 `204` 的 response 消费、4 秒 force 和 5 秒绝对截止。浏览器和阻塞 seam 只属于测试基础设施，不是运行时包或依赖。生产实现由七个职责单一的模块组成，每个不超过 250 纯 LOC。

## 三拨盘

预览页或方案说明必须用中文展示三拨盘：

| 拨盘 | 含义 | 用户可怎么调 |
|---|---|---|
| 视觉冒险度 | 构图、色块、字体对比、视觉隐喻的大胆程度 | “更稳一点 / 更大胆” |
| 动效强度 | 动画数量、转场复杂度、反馈层次 | “少点动效 / 更有动感” |
| 信息密度 | 留白与内容密度、数据量、控件密度 | “更清爽 / 信息更密” |

内部可把它们映射为 `variance / motion / density`，但用户可见说明必须是中文。

## 方向卡要求

每次给 3–4 个方向，至少一个标注“推荐”。每个方向必须有：

1. 方向名：短、可记忆。
2. 互斥约束：字体轴 / 明暗轴 / 布局轴 / 密度轴至少不同两项。
3. 真实 mini mockup：真字体、真颜色、真布局、真实文案；不要只给色板或说明文字。
4. 一句适用场景：什么时候应该选它。
5. 明显选择按钮：`选择 A/B/C/D · 方向名`。

预览外壳保持中性一致，方向差异只发生在 mockup 内。不要让每次预览都换一种选择交互。

## 验收清单

- [ ] 方向之间不是换色版本；遮住颜色仍能看出布局 / 字体 / 密度差异。
- [ ] mockup 里用了真实内容，不用 Lorem ipsum / Acme / John Doe / 假精确数字。
- [ ] 说明和样机分区展示；用户第一眼先看设计，不被长解释淹没。
- [ ] 按钮明显且不重复；没有“点这里选择”这类多余小字堆叠。
- [ ] 移动端可读，无横向滚动，mini mockup 不挤压文字。
- [ ] 推荐只是建议；必须用户明确选择或授权默认后，才进入正式实现。
- [ ] manifest、choice、feedback、dial、status 和 bootstrap 满足明示契约；静态模式不联网。

## 和本设计语言的关系

风格试衣间只决定“方向”，不替代 `DESIGN.md` 的全局 DNA、NEVERS、token 纪律、Redesign Audit 和页面级反 slop 审稿。正式实现仍必须使用当前 preset、语义 token、分级圆角、具名动效和完整状态。
