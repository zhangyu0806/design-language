## 背景

风格试衣间当前产出可直接通过 `file:` 打开的自包含 HTML。这个默认路径必须继续工作。新增能力只解决一个窄问题：用户显式启动本机工具后，预览页可以把一次方向选择写成后续 agent 可读取的 `selection.json`。

该工具处理的是当前用户拥有的可信预览目录，不是通用开发服务器，也不是远程协作服务。静态 `file:` 预览继续跨平台工作；持久服务只支持 Linux/WSL2，因为安全读取必须依赖可验证的 `/proc/self/fd`。它不修改目标应用、starter、依赖或锁文件，`dl-apply` 也不会复制或启动它。

## 目标与非目标

### 目标

- 保留静态、自包含 HTML 的默认体验。
- 用唯一 manifest 和显式 `data-dl-*` 属性建立可验证的 HTML 契约，不根据标签、类名、文案或节点位置猜测含义。
- 仅在 Linux/WSL2 使用 Node.js 22 内置模块和可用的 `/proc/self/fd`，在 `127.0.0.1` 上提供受限静态服务和选择 API。
- 对 Host、Origin、请求帧、路径、选择数据、文件权限和进程生命周期给出可测试的确定规则。
- 将当前 session 的选择以同目录原子替换方式写入固定文件 `selection.json`。

### 非目标

- 不提供公网监听、IPv6 监听、host 配置、自动打开浏览器、daemon、watch、tunnel、共享链接或 CORS。
- 不提供身份系统，也不防御当前用户权限下的恶意本地进程。
- 不修改被预览应用的源码、路由、构建配置或运行时依赖。
- 不承诺掉电后的目录项持久性，也不把旧 `selection.json` 当作当前 session 的结果。
- 不承诺 macOS、Windows 原生环境或其他缺少可用 `/proc/self/fd` 的平台可以启动持久服务。

## 信任模型

可信输入只有命令行指定、由当前用户拥有的预览根目录及其中预先存在的普通预览资产。浏览器请求、URL、Host、Origin、请求头、请求体、manifest 内容和符号链接目标都按不可信输入处理。

服务固定绑定 IPv4 回环地址 `127.0.0.1`。这能阻止网络侧直接访问，但不能阻止同一台机器上的网页发起 DNS rebinding 或跨源请求，因此还必须校验 Host 和 Origin。它也不能阻止同用户进程读取 session、替换可信目录内容或直接改写 `selection.json`。这些限制会在 ready 输出和文档中明确，而不是用不真实的安全承诺掩盖。

启动顺序是安全边界的一部分。CLI 必须先确认 `process.platform === "linux"`，再以非用户根目录中的探针文件描述符验证 `/proc/self/fd/<fd>` 可打开且与原描述符指向同一对象。只有验证通过后，才允许读取或 `realpath` 用户预览根目录、解析其 HTML、创建监听 socket、清理临时文件或写入任何内容。失败只输出 `{"event":"error","code":"PREVIEW_START_FAILED"}`，不得暴露平台、路径或底层错误。WSL2 走同一 Linux 检查，不单独猜测发行版。

## 源码架构

生产源码拆成七个 ES module，每个文件不超过 250 行纯 LOC。模块之间只传递已解析的值，不共享可变全局状态。

| 模块 | 单一职责 |
|---|---|
| `scripts/dl-preview-cli.mjs` | 解析 CLI、解析预览根目录、启动服务、输出 JSON 行、设置退出码和信号处理 |
| `scripts/dl-preview-server.mjs` | 创建 HTTP server、路由、连接跟踪、正常模式与 `--exit-on-select` 生命周期 |
| `scripts/dl-preview-protocol.mjs` | Host/Origin、方法、媒体类型、请求帧、32 KiB body 和稳定错误响应 |
| `scripts/dl-preview-paths.mjs` | URL 路径解析、真实路径 containment、保护路径、MIME 和静态 GET/HEAD |
| `scripts/dl-preview-html.mjs` | 无依赖扫描 HTML，发现唯一活动 manifest script，并拒绝注释、惰性、raw-text、外来命名空间和歧义 |
| `scripts/dl-preview-selection.mjs` | manifest JSON 与选择 schema、session、FIFO 存储状态和 `0600` 原子落盘 |
| `scripts/dl-preview-lifecycle.mjs` | 信号、连接、force fence、4 秒优雅期与 5 秒绝对截止时间 |

测试与 fixture helper 不计入这七个生产模块，但测试文件同样按职责拆分。不得引入根 `package.json`、运行时第三方包或复制其他项目的代码与品牌。真实 Chrome/Chromium 可由 CI 镜像或仓库测试工具提供，只是测试基础设施，不得成为服务或预览页的运行时 npm 依赖。

## CLI 与机器输出

命令形式为：

```text
node scripts/dl-preview-cli.mjs [--port <0..65535>] [--exit-on-select] <preview-directory>
```

`--port` 默认 `0`，由操作系统分配空闲端口。host 固定为 `127.0.0.1`，不存在 `--host`。输出文件固定为预览根目录中的 `selection.json`，不存在可改名或可越出根目录的输出参数。

stdout 只写单行 JSON 事件。成功监听后恰好写一条：

```json
{"event":"ready","url":"http://127.0.0.1:43123/","host":"127.0.0.1","port":43123,"output":"selection.json","session":"<43-char-base64url>"}
```

不支持的平台、`/proc/self/fd` 不可用及其他启动失败都写同一条不含绝对路径、stack、请求体、反馈或系统错误原文的事件，并以非零状态退出：

```json
{"event":"error","code":"PREVIEW_START_FAILED"}
```

运行期请求错误只返回给请求方，不写 stdout。SIGINT 正常退出码为 `130`，SIGTERM 为 `143`，`--exit-on-select` 成功退出为 `0`。CLI 参数错误使用 `2`。

## HTML manifest 与 DOM 契约

文档必须恰好包含一个 manifest：

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

`directions` 必须有 3 或 4 项。每个 `id` 必须匹配 `^[a-z][a-z0-9-]{0,31}$` 且唯一，`label` 是去除首尾空白后 1 至 80 个 Unicode 字符的字符串，`recommended` 必须是布尔值，并且恰好一项为 `true`。`dials` 必须只含 `variance`、`motion`、`density`，值均为 0 至 100 的整数。manifest 各层均拒绝未知字段。

服务端不得用正则或普通文本搜索发现 manifest。专用 HTML 发现模块必须按 HTML tokenizer 的等价状态扫描完整文档，只接受 HTML namespace 中、解析活动且不在 `<template>` 等惰性子树内的真实 `<script id="dl-preview-manifest" type="application/json">`。用于判断 manifest `id`、`type` 和 MathML `annotation-xml[encoding]` HTML integration point 的属性值，必须先按浏览器 tokenizer 的字符引用规则解码，再按浏览器规则比较语义值；实现必须通过真实 Chrome 差分测试证明编码与未编码的等价属性得到相同候选和命名空间结论。这个解码只适用于 HTML 语义属性值，`script` 元素中的 JSON raw text 必须保持原始字符序列并直接交给 JSON parser，绝不能做 HTML entity 解码。注释中的伪标签、`script/style/textarea/title/xmp/iframe/noembed/noframes/plaintext` 等 raw-text 或 RCDATA 内容里的伪标签、SVG/MathML 等外来命名空间节点都不计为候选。标签、属性、引号、注释、raw-text 结束或命名空间边界 malformed，或者存在零个、多个、重复属性及其他无法唯一映射到浏览器活动 DOM 的歧义时，启动必须失败。该扫描器只用 Node.js 内置能力，不增加运行时依赖。

DOM 必须显式提供：

- 一个预览根元素 `[data-dl-preview]`。
- 每个 manifest direction 恰好一个 `<button type="button" data-dl-choice="<id>" aria-pressed="false">`，且不能出现 manifest 外的 choice。
- 恰好一个反馈控件 `<textarea data-dl-feedback maxlength="2000">`。
- 三个 `<input type="range" min="0" max="100" step="1" data-dl-dial="variance|motion|density">`，每个键恰好一次，初值与 manifest 一致。
- 恰好一个 `[data-dl-status][aria-live="polite"]` 状态区域。

bootstrap 只通过上述 ID 和属性取节点。它不会寻找卡片、标题、按钮文案、类名、父子位置或第几个元素，也不会从视觉 DOM 反推方向名称。

## 静态安全 bootstrap

bootstrap 在任何模式下先解析并验证 manifest 与显式 DOM 对应关系。客户端 manifest 为 null、方向字段类型错误或其他 malformed 输入时，bootstrap 不得抛出异常、发起任何网络请求或注册任何事件监听器。此时只有在文档中存在唯一合法的 `[data-dl-status][aria-live="polite"]` 状态节点时，才把它的 `textContent` 精确设为 `预览配置无效`；状态节点缺失、重复或自身不合法时不得猜测替代节点，也不得修改其他内容。

默认 `file:` 模式不发出 fetch、XHR、WebSocket 或 beacon。点击方向只在页面内更新 `aria-pressed` 和状态文案，反馈与拨盘仍可编辑，但不会声称结果已保存。

只有当页面协议为 `http:`、hostname 严格等于 `127.0.0.1`，且 manifest/DOM 验证通过时，bootstrap 才先同源请求 `GET /__dl/session`。拿到合法 session 后，点击显式 choice 才向同源相对 URL `POST /__dl/select` 发送选择。持久化成功只接受精确 HTTP `204`；客户端必须先完整消费该 response，再显示成功状态。任何其他 2xx、网络失败或校验失败都只显示安全的中文失败状态，不展示响应原文、stack 或绝对路径。页面在 `localhost`、其他 hostname、HTTPS 或非 HTTP 协议下仍按静态模式运行。

## HTTP 路由与方法

| 路径 | 允许方法 | 成功结果 | 其他方法 |
|---|---|---|---|
| `/__dl/session` | `GET` | `200 application/json; charset=utf-8`，`{"schemaVersion":1,"session":"..."}` | `405`，`Allow: GET` |
| `/__dl/select` | `POST` | 写入完成后 `204` | `405`，`Allow: POST` |
| `/` 和允许的静态路径 | `GET`, `HEAD` | 白名单 MIME 的文件；HEAD 与 GET 同头无 body | `405`，`Allow: GET, HEAD` |
| 其他 `/__dl/*` | 无 | `404` | `404` |
| 不存在或被保护的静态路径 | `GET`, `HEAD` | `404` | `405` |

静态目录请求不生成 listing，也不做 SPA fallback。`/` 只映射到根目录的 `index.html`。所有成功响应设置 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和 `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`。

## Host、Origin 与 CORS

服务启动后记录实际端口，并只接受 Host 精确等于 `127.0.0.1:<actual-port>` 的请求。缺失、重复、带空白变体、`localhost`、其他 IP、其他端口或 absolute-form target 均返回 `421`。

任何请求只要带 Origin，就必须精确等于 `http://127.0.0.1:<actual-port>`。`POST /__dl/select` 还必须带这个 Origin，缺失、`null`、重复或不匹配返回 `403`。普通导航和静态 GET 可以不带 Origin。所有响应都不得发送 `Access-Control-Allow-*`，`OPTIONS` 不作预检特判，按方法矩阵返回 `405`。

## 请求帧与 32 KiB 限制

`POST /__dl/select` 只接受单个 `Content-Type: application/json`，允许参数仅为 `charset=utf-8`。请求必须有且只有一个十进制 `Content-Length`，值不得大于 32768 字节。任何 `Transfer-Encoding`、重复或逗号合并的 Content-Length、非数字长度、长度不一致、提前结束或超额数据均在解析 JSON 前拒绝。缺失长度返回 `411`，声明超过限制返回 `413`，其他帧错误返回 `400`。

server 设置 5 秒 headers timeout、5 秒 request timeout 和 2 秒 keep-alive timeout，并把 Node.js 的过期连接检查间隔显式收窄到 250 毫秒，使不完整 headers 和不完整声明 body 的连接实际在 5 秒期限附近关闭，而不是只赋值 timeout 属性后等待默认约 30 秒的检查周期。body 按 Buffer 累计，达到声明长度后不再接受额外字节。UTF-8 解码、JSON 解析和 schema 校验只在完整帧通过后发生。失败响应会关闭该连接，防止剩余字节被解释为下一请求。

## 静态路径安全

URL pathname 必须能严格 percent-decode，拒绝 NUL、反斜杠、编码或未编码的 `.`、`..` 段、重复分隔符和空的中间段。每个路径段以 `.` 开头时均视为 dotfile 并返回 `404`。

根目录启动时先 `realpath`。每次静态请求都对候选文件执行 `realpath`，并用路径分隔符边界确认结果等于根目录内的后代；不存在、非普通文件、符号链接逃逸或竞态导致打开后的真实对象不符合约束时统一返回 `404`。实现通过打开文件描述符后读取和 `fstat`，不先检查再按路径二次打开。

`selection.json`、任何 basename 以 `.selection.json.` 开头的临时文件、`.openspec.yaml` 以及所有 dotfile 永远不可通过静态路由读取。静态 MIME 白名单仅为 `.html`、`.css`、`.js`、`.mjs`、`.json`、`.svg`、`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.woff`、`.woff2`、`.txt`；其他扩展名返回 `404`。

## 选择 schema 与结果格式

POST body 必须精确符合：

```json
{
  "schemaVersion": 1,
  "session": "<43-char-base64url>",
  "choice": "a",
  "feedback": "用户可选反馈",
  "dials": {"variance": 50, "motion": 50, "density": 50}
}
```

顶层和 `dials` 均拒绝未知字段。`session` 必须与当前进程一致。`choice` 必须是 manifest 中的 ID。`feedback` 必须是字符串，去除首尾空白后最多 2000 个 Unicode 字符，允许空字符串，拒绝 NUL。三拨盘必须是 0 至 100 的整数。schema 错误返回 `422`，错误 session 返回 `409`。

成功文件为 UTF-8 JSON 加末尾换行，字段固定为 `schemaVersion`、`session`、`choice`、`directionLabel`、`feedback`、`dials`、`selectedAt`。`directionLabel` 来自 manifest，不采信请求；`selectedAt` 是服务生成的 UTC ISO 8601 时间。每次进程启动用 `crypto.randomBytes(32)` 生成无填充 base64url session，旧文件可保留，但 session 不匹配时客户端和后续 agent 都不得把它视为当前结果。

## 原子写入与并发

有效请求进入单进程 FIFO 写队列。临时文件必须位于预览根目录，严格名称为 `.selection.json.<24-lowercase-hex>.<24-lowercase-hex>.tmp`。第一段是创建 store 时用 `crypto.randomBytes(12)` 生成的 store instance id，第二段是每个入队 job 用 `crypto.randomBytes(12)` 独立生成的 job id，两段都编码为 24 位小写十六进制。临时文件用 `O_CREAT|O_EXCL` 创建并立即保证 mode `0600`。实现先写完整内容，再对文件描述符执行 `chmod(0600)` 和 `fsync`，关闭后用 `rename` 原子替换 `selection.json`。任何失败都尽力删除本次临时文件，返回稳定 `500`，且不破坏先前完整结果。成功响应只在 rename 完成后发送。

存储状态必须显式建模为 `OPEN`、`DRAINING`、`FORCED`、`CLOSED`。`OPEN` 按验证完成顺序接收 FIFO 工作；进入 `DRAINING` 的 close 操作原子拒绝新工作，但已排队工作可继续；进入 `FORCED` 后拒绝新工作，所有尚未开始的排队工作必须失败且永不启动。force fence 建立后，不得开始创建临时文件、写入、chmod、fsync、close 或 rename 的下一阶段，也不得开始任何新工作；已经进入的不可中断文件系统调用只能等待返回或由外层截止时间终止进程。所有在途与排队 promise 都完成或被稳定拒绝后进入 `CLOSED`。状态转换保持 FIFO，不允许 `forceClose` 绕过队列后又启动旧任务。

普通模式持续运行，按有效请求完成 body 校验后进入队列的顺序写入，每个请求收到各自写入结果；后来的成功选择可以替换先前选择。

`--exit-on-select` 模式中，第一个通过全部验证的请求原子占有选择权。其写入期间，其他有效选择返回 `409 SELECTION_ALREADY_ACCEPTED`。首个写入成功并发送 `204` 后，服务停止接受新连接，排空该响应并退出 `0`。若首个写入失败，选择权释放，后续有效请求仍可尝试。

## 关闭与错误

SIGINT、SIGTERM 和成功的 `--exit-on-select` 共用一个以关闭开始时刻计时的预算。它们先停止 accept 并让 store 进入 `DRAINING`，从第 0 秒起给在途工作 4 秒优雅期；到第 4 秒建立 force fence、进入 `FORCED`、拒绝尚未开始的队列工作并销毁剩余连接。第 5 秒是包含 force 阶段在内的绝对外层截止时间，不能因清理、promise 或文件系统停顿重新计时或延长。正常完成则提前进入 `CLOSED` 并退出。

临时文件句柄和属于当前进程且尚未 rename 的临时文件应尽力清理。极端不可中断文件系统停顿可能使进程在绝对截止时间退出时留下已按 `0600` 创建的临时文件；下次成功通过平台探针后、读取用户 manifest 或监听前，服务只按严格临时文件命名规则尽力清理这些文件。该例外不允许 force fence 后开始新的工作阶段或 rename。

HTTP 错误统一为 `application/json; charset=utf-8`，格式为 `{"error":{"code":"STABLE_CODE"}}`。不得返回绝对路径、stack、Node 系统错误原文、请求头、请求体、session、反馈或 manifest 内容。静态不存在与受保护路径都使用同一 `404 NOT_FOUND`，避免暴露文件是否存在。

## 迁移与回滚

迁移分两步。先扩展预览 HTML 生成规范，使新页面包含 manifest、显式属性和静态安全 bootstrap；旧页面继续作为普通静态 HTML 使用。随后增加独立 CLI 和文档入口。没有服务时，新页面仍可直接打开和本地选择，不产生持久化副作用。

回滚只需停止使用或删除独立 CLI 与其文档入口。HTML 的显式属性和 manifest 对静态展示无害，可保留，也可由生成器恢复到旧模板。`selection.json` 是预览产物，不参与应用构建；回滚不需要修改 starter、目标应用或 `dl-apply`。

## 剩余风险

- 同用户恶意进程可读取 ready 输出、访问回环端口、替换可信目录文件或直接修改结果，本设计不声称阻止它。
- 文件 `fsync` 与原子 rename 能防止进程崩溃留下半文件，但未对目录执行 fsync，因此断电后最新目录项可能丢失。
- 极端不可中断文件系统调用可能跨过 5 秒进程截止时间并留下 mode `0600` 的临时文件；下次启动会尽力清理，但不承诺在故障中的文件系统上同步完成清理。
- 浏览器内联脚本需要 CSP 的 `'unsafe-inline'`。其输入只来自严格 manifest 和显式控件，不拼接 HTML；若未来引入任意用户 HTML，必须重新评估该边界。

## 验证策略

仓库必须拥有可重复运行的真实 Chromium E2E，覆盖静态 `file:`、本机服务、malformed manifest、精确 `204` 响应消费和关闭后的页面状态。HTML 发现回归还必须把服务端扫描结果与真实 Chrome 解析结果做差分比较，覆盖 manifest `id`、`type` 和 MathML integration 相关属性中的命名与数字字符引用，同时证明 JSON script text 不被 entity 解码。该门禁在本地标准测试入口与 CI 都必须执行。

浏览器验证包含两个用途不同的控制。fetch-abort 监控控制必须在真实 Chrome 中发出慢请求并中止它，确认 CDP 实际观察到与该 request id 对应的 `Network.loadingFailed`、`net::ERR_ABORTED` 和 `canceled: true`；它只证明网络事件诊断链有效，不能替代浏览器门禁失败证明。另设浏览器门禁元控制，由外层测试启动内层子进程。正常和中止内层必须调用同一个实际生产预览 E2E helper 与流程：启动生产 CLI，加载符合契约的 HTML，等待 session 与 DOM ready，再通过真实页面交互发出实际 `POST /__dl/select`。正常内层必须继续观察该请求的精确 `204`、对应的 `Network.loadingFinished`、页面成功状态，以及 mode `0600` 的 `selection.json`，然后以 `0` 退出。中止内层必须在同一实际选择请求出现 `Network.requestWillBeSent` 后，由测试层 `Fetch` pause 保持该请求，再杀死 Chrome，并要求内层以非零状态退出；不得用通用 data URL、单独 CDP promise 或未走生产 CLI 和 bootstrap 的合成请求代替。外层断言只有同时观察到正常内层为零、中止内层为非零时才通过，防止把跳过、未启动或中止后的静默退出误报为门禁成功。Chrome/Chromium 只属于测试基础设施，不得给生产服务、bootstrap 或预览 HTML 增加运行时 npm 依赖。

生命周期测试必须以可控文件系统 seam 确定性阻塞写入，分别向真实子进程发送 SIGINT 和 SIGTERM，证明 4 秒进入 force、5 秒绝对退出、排队未开始工作不执行、force fence 后不开始 rename。不得用概率竞态或依赖机器负载的短暂 sleep 代替阻塞控制。

HTTP timeout 测试必须用真实 raw socket 分别发送未结束的 headers 和声明长度大于已发送内容的不完整 body，并用单调时钟证明两类连接都在 5 秒期限附近关闭。测试必须设置有界 watchdog、销毁 socket 并清理 timer；不得把“属性值等于 5000”当作实际 timeout 已执行的证据，也不得以额外 socket timeout、每请求 timer 或自定义 HTTP parser 代替 Node.js 原生 headers/request timeout。
