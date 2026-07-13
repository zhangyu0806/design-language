## ADDED Requirements

### Requirement: CLI 必须是显式、固定回环的零依赖工具

CLI MUST 仅支持 Linux/WSL2，在 Node.js 22 上只使用内置模块，形式 MUST 为 `node scripts/dl-preview-cli.mjs [--port <0..65535>] [--exit-on-select] <preview-directory>`。port MUST 默认 `0`，host MUST 固定为 `127.0.0.1`，MUST NOT 提供 host、daemon、watch、tunnel、自动打开或可变输出路径。输出文件 MUST 固定为根目录 `selection.json`，工具 MUST NOT 修改应用源码、starter、依赖、锁文件或 `dl-apply` 行为。跨平台默认能力 MUST 保持为直接通过 `file:` 打开静态预览。

#### Scenario: 使用默认参数启动

- **WHEN** 用户对可信预览目录显式运行 CLI
- **THEN** 进程在 `127.0.0.1` 的系统分配端口监听，并只准备写入该目录的 `selection.json`

#### Scenario: 用户传入不支持的能力

- **WHEN** 用户传入 `--host`、daemon、watch、tunnel、自动打开或输出路径选项
- **THEN** CLI 以参数错误退出，且不启动服务或修改任何项目文件

#### Scenario: 非 Linux 平台尝试启动持久服务

- **WHEN** 用户在 macOS、Windows 原生环境或其他非 Linux 平台运行 CLI
- **THEN** CLI 在访问用户预览根目录、监听或写入前输出稳定私有启动错误并非零退出，静态 `file:` 预览仍可使用

#### Scenario: Linux 缺少可用的 proc fd

- **WHEN** CLI 无法证明 `/proc/self/fd/<fd>` 可打开且与探针文件描述符指向同一对象
- **THEN** CLI 在访问用户预览根目录、监听、清理或写入前只输出 `PREVIEW_START_FAILED` 并非零退出

### Requirement: 进程输出必须稳定且不泄密

监听成功后 stdout MUST 恰好输出一条 JSON ready 事件，字段 MUST 为 `event`、`url`、`host`、`port`、`output`、`session`。启动失败 MUST 输出稳定 error code 并非零退出。输出 MUST NOT 包含绝对路径、stack、系统错误原文、请求头、请求体或反馈。参数错误退出码 MUST 为 `2`，成功的 exit-on-select MUST 为 `0`，SIGINT MUST 为 `130`，SIGTERM MUST 为 `143`。

#### Scenario: 服务成功监听

- **WHEN** 根目录和 manifest 合法且 socket 绑定成功
- **THEN** stdout 输出一条包含实际 `127.0.0.1` URL、端口、`selection.json` 和当前 session 的 ready JSON 行

#### Scenario: 启动失败

- **WHEN** 根目录、manifest 或监听初始化失败
- **THEN** stdout 只输出稳定错误 code，不暴露绝对路径或底层错误，并以非零状态退出

### Requirement: 服务必须采用七个受限源码模块

生产实现 MUST 由 `dl-preview-cli.mjs`、`dl-preview-server.mjs`、`dl-preview-protocol.mjs`、`dl-preview-paths.mjs`、`dl-preview-html.mjs`、`dl-preview-selection.mjs`、`dl-preview-lifecycle.mjs` 七个职责单一的模块组成。HTML 发现与关闭生命周期 MUST 分别由专用模块负责。每个文件 MUST 不超过 250 行纯 LOC，且 MUST NOT 增加运行时第三方依赖、根 `package.json` 或其他项目的代码与品牌。

#### Scenario: 实现进入验收

- **WHEN** 维护者检查生产源码结构和依赖
- **THEN** 七个模块分别负责 CLI、HTTP 路由、协议、静态路径、HTML 发现、选择存储和关闭生命周期，每个模块在行数上限内且只引用 Node.js 22 内置模块

### Requirement: 服务端 manifest 发现必须等价于活动 DOM

服务 MUST 扫描完整 HTML，并 MUST 找到恰好一个浏览器活动 DOM 等价的 HTML namespace `script#dl-preview-manifest[type="application/json"]`。用于比较 manifest `id`、`type` 和判断 MathML `annotation-xml[encoding]` HTML integration point 的属性值，MUST 先按浏览器 tokenizer 行为完成字符引用解码，再按浏览器规则比较解码后的语义值。`script` 中的 JSON raw text MUST 保持原始字符序列并直接交给 JSON parser，MUST NOT 做 HTML entity 解码。扫描 MUST 拒绝注释中的伪标签、惰性 `<template>` 子树、raw-text 或 RCDATA 元素内容中的伪标签、SVG/MathML 等外来命名空间节点、重复属性、malformed 标签/属性/引号/注释/结束状态，以及零个、多个或无法唯一映射的候选。实现 MUST NOT 使用正则或普通文本搜索作为发现器，也 MUST NOT 增加运行时依赖。仓库 MUST 用真实 Chrome 差分测试比较浏览器解析结果与服务扫描结果，覆盖上述语义属性的命名和数字字符引用。

#### Scenario: 注释和 raw-text 含伪 manifest

- **WHEN** HTML 注释、script/style/textarea/title/xmp/iframe/noembed/noframes/plaintext 内容中出现看似合法的 manifest 标签
- **THEN** 这些文本不计为候选，服务只接受活动 DOM 中恰好一个真实 manifest

#### Scenario: 惰性或外来命名空间含 manifest

- **WHEN** manifest 标签只位于 template 惰性子树、SVG 或 MathML 命名空间
- **THEN** 服务不把它视为活动 HTML manifest，启动失败且不监听

#### Scenario: 编码属性与浏览器语义等价

- **WHEN** manifest 的 `id`、`type` 或 MathML `annotation-xml[encoding]` 使用浏览器会解码的命名或数字字符引用
- **THEN** 服务按解码后的语义值判断候选与命名空间，且真实 Chrome 差分测试得到相同结论

#### Scenario: JSON script text 含 entity 形式文本

- **WHEN** 合法 manifest 的 JSON raw text 字符串中出现 `&amp;` 或其他形似 HTML entity 的字符序列
- **THEN** 服务不对 JSON script text 做 entity 解码，JSON parser 和浏览器读取到相同的原始文本值

#### Scenario: 活动候选歧义或 HTML malformed

- **WHEN** 活动 DOM 中存在多个候选、重复关键属性，或标签、属性、引号、注释、raw-text 结束及命名空间边界 malformed
- **THEN** 服务以稳定私有启动错误拒绝文档，不从文本顺序猜选候选

### Requirement: 路由和方法必须使用固定矩阵

服务 MUST 仅允许 `GET /__dl/session`、`POST /__dl/select` 以及静态路径的 GET/HEAD。错误方法 MUST 返回 `405` 和精确 `Allow`，未知 `/__dl/*` MUST 返回 `404`，静态目录 MUST NOT listing 或 SPA fallback。`/` MUST 只映射到 `index.html`。成功响应 MUST 设置 no-store、nosniff、no-referrer 和限制 default/script/style/img/font/connect/object/base/frame/form 的 CSP。

#### Scenario: 客户端读取 session 并提交选择

- **WHEN** 合法同源客户端依次 GET session 和 POST selection
- **THEN** session 返回严格 JSON，selection 在写入完成后返回 `204`

#### Scenario: 客户端对选择端点发 GET

- **WHEN** 请求为 `GET /__dl/select`
- **THEN** 服务返回 `405`、`Allow: POST`，不进入静态路由

#### Scenario: 客户端对静态文件发 HEAD

- **WHEN** 合法静态文件收到 HEAD 请求
- **THEN** 服务返回与 GET 相同的状态和响应头，但不发送 body

### Requirement: Host 与 Origin 必须阻止跨站和 rebinding

每个请求的 Host MUST 唯一且精确等于 `127.0.0.1:<actual-port>`。缺失、重复、其他 hostname/IP/端口、空白变体或 absolute-form target MUST 返回 `421`。任何存在的 Origin MUST 精确等于 `http://127.0.0.1:<actual-port>`；选择 POST 还 MUST 要求该 Origin 存在，否则返回 `403`。服务 MUST NOT 返回任何 `Access-Control-Allow-*`，OPTIONS MUST 按普通方法矩阵处理。

#### Scenario: DNS rebinding 使用不同 Host

- **WHEN** 回环连接携带攻击者域名、localhost 或错误端口作为 Host
- **THEN** 服务在路由和 body 处理前返回 `421`

#### Scenario: 跨源页面提交选择

- **WHEN** POST 的 Origin 缺失、为 `null` 或与精确回环 origin 不同
- **THEN** 服务返回 `403`，不读取为有效选择，也不写文件

#### Scenario: 浏览器发送预检

- **WHEN** 浏览器向选择端点发送 OPTIONS
- **THEN** 服务返回方法错误且不含 CORS 许可头

### Requirement: 选择请求帧必须严格限制为 32 KiB

选择 POST MUST 只接受单个 `application/json` Content-Type，可选参数仅为 `charset=utf-8`。请求 MUST 有且只有一个合法十进制 Content-Length，且 MUST 不超过 32768 字节。服务 MUST 在 JSON 解析前拒绝任何 Transfer-Encoding、重复或合并长度、非数字长度、长度不一致、提前结束和超额数据。缺失长度 MUST 返回 `411`，超限 MUST 返回 `413`，其他帧错误 MUST 返回 `400` 并关闭连接。headers timeout 与 request timeout MUST 为 5 秒，keep-alive timeout MUST 为 2 秒；服务 MUST 显式把 Node.js 过期连接检查间隔设为 250 毫秒，使不完整 headers 和不完整声明 body 的连接实际在 5 秒期限附近关闭，而不是等待默认约 30 秒的检查周期。

#### Scenario: 原始 socket 发送 chunked body

- **WHEN** 选择请求含任何 Transfer-Encoding
- **THEN** 服务在解析 JSON 前返回 `400` 并关闭连接，不写文件

#### Scenario: 原始 socket 停在不完整 headers

- **WHEN** 客户端发送请求行和部分 headers，但不发送结束 headers 的空行
- **THEN** 服务通过原生 headers timeout 在 5 秒期限附近关闭连接，真实 socket 回归用单调时钟和有界 watchdog 证明实际关闭，而不只检查配置属性

#### Scenario: 原始 socket 停在不完整声明 body

- **WHEN** 客户端发送完整 headers、声明 Content-Length，但只发送部分 body 并保持连接打开
- **THEN** 服务通过原生 request timeout 在 5 秒期限附近关闭连接，且不增加独立 socket timeout、每请求 timer 或自定义 HTTP parser

#### Scenario: 声明 body 超过限制

- **WHEN** Content-Length 大于 32768
- **THEN** 服务返回 `413`，不缓存或解析 body

#### Scenario: body 短于或长于声明长度

- **WHEN** 原始请求提前结束或在声明长度后继续发送数据
- **THEN** 服务返回 `400` 并关闭连接，额外字节不会成为下一请求

### Requirement: 静态文件必须受真实路径和保护路径约束

服务 MUST 对启动根目录和每个候选文件使用 realpath，并 MUST 在打开文件描述符后用 `fstat` 确认普通文件和根目录 containment。路径 MUST 拒绝 NUL、反斜杠、无法解码、编码或明文的 `.`/`..`、重复分隔符、空中间段、dotfile 和符号链接逃逸。`selection.json`、`.selection.json.*` 临时文件、`.openspec.yaml` 和所有 dotfile MUST 永不可读。MIME MUST 只允许设计中列出的静态扩展，其他类型、目录和受保护路径 MUST 统一返回 `404`。

#### Scenario: URL 尝试路径穿越或符号链接逃逸

- **WHEN** 请求包含 `..`、编码穿越、反斜杠，或候选符号链接解析到根目录外
- **THEN** 服务返回统一 `404`，不泄露目标是否存在

#### Scenario: 请求选择结果或临时文件

- **WHEN** GET 或 HEAD 指向 `selection.json` 或 `.selection.json.*`
- **THEN** 服务返回与普通不存在文件相同的 `404`

#### Scenario: 请求合法预览资产

- **WHEN** 路径解析为根目录内允许 MIME 的预先存在普通文件
- **THEN** 服务从已验证的文件描述符返回资产，并带安全响应头

### Requirement: session 必须随机且隔离每次进程

每次启动 MUST 用 `crypto.randomBytes(32)` 生成新的无填充 base64url session，长度 MUST 为 43 个字符。session 端点和 ready 事件 MUST 指向同一个当前值。选择 session MUST 精确匹配当前进程，旧 `selection.json` 的 session MUST NOT 被认作当前选择。

#### Scenario: 服务连续启动两次

- **WHEN** 同一目录中的服务停止后重新启动
- **THEN** 新进程产生不同 session，携带旧 session 的选择返回 `409` 且不改写结果

### Requirement: 选择对象必须严格匹配 manifest

选择 JSON MUST 只含 `schemaVersion`、`session`、`choice`、`feedback`、`dials`。schemaVersion MUST 为 `1`，choice MUST 是 manifest direction ID，feedback MUST 是去除首尾空白后最多 2000 个 Unicode 字符且不含 NUL 的字符串，dials MUST 只含三个规定键和 0 至 100 的整数。顶层和拨盘 MUST 拒绝未知字段。schema 错误 MUST 返回 `422`，session 错误 MUST 返回 `409`。

#### Scenario: 合法选择匹配 manifest

- **WHEN** 当前 session 提交 manifest 中的 choice、合法反馈和三个整数拨盘
- **THEN** 服务使用 manifest 中的方向名称构造结果，不信任客户端提供其他展示数据

#### Scenario: 选择含额外字段或未知方向

- **WHEN** body 含额外键、未知 choice、超长反馈、NUL 或非法拨盘值
- **THEN** 服务返回 `422`，不进入写队列且不改变已有结果

### Requirement: 结果必须以 0600 同目录原子写入

结果 MUST 是 UTF-8 JSON 加末尾换行，字段 MUST 固定为 `schemaVersion`、`session`、`choice`、`directionLabel`、`feedback`、`dials`、`selectedAt`。临时文件 MUST 位于根目录，名称 MUST 严格匹配 `.selection.json.<24-lowercase-hex>.<24-lowercase-hex>.tmp`，其中第一段 MUST 是创建 store 时以密码学随机数生成的 store instance id，第二段 MUST 是每个入队 job 独立以密码学随机数生成的 job id；两段 MUST 各为 24 位小写十六进制。临时文件 MUST 以排他方式创建。实现 MUST 完整写入、对文件描述符设置 `0600`、执行文件 fsync、关闭，再 rename 替换 `selection.json`。写入失败 MUST 清理本次临时文件、保留先前完整结果并返回稳定 `500`。

#### Scenario: 选择成功落盘

- **WHEN** 合法选择完成写入
- **THEN** `selection.json` 以 mode `0600` 原子出现，含服务生成的方向名称和 UTC ISO 8601 时间，响应随后返回 `204`

#### Scenario: rename 前发生写入失败

- **WHEN** 临时文件写入、chmod、fsync 或关闭失败
- **THEN** 服务返回安全的稳定错误，旧 `selection.json` 保持完整，本次临时文件被尽力清理

### Requirement: 普通模式必须串行处理并允许后续选择

普通模式 MUST 将通过全部验证的请求按完成 body 校验后的进入顺序放入单进程 FIFO 写队列。每个请求 MUST 等待自身写入结果，后来的成功选择 MUST 可以原子替换先前选择，服务 MUST 继续运行。

#### Scenario: 两个合法选择并发到达普通模式

- **WHEN** 两个请求依次完成验证并进入队列
- **THEN** 服务按 FIFO 完成两个写入并分别响应，最终文件对应后进入队列的成功选择

### Requirement: 存储关闭必须使用显式状态和 force fence

存储 MUST 使用 `OPEN`、`DRAINING`、`FORCED`、`CLOSED` 四个显式状态。`OPEN` MUST 按验证完成顺序接受 FIFO 工作；close MUST 原子进入 `DRAINING` 并拒绝新工作，但允许已排队工作继续。force MUST 进入 `FORCED`，拒绝新工作并稳定拒绝所有尚未开始的排队工作；这些工作 MUST 永不开始。force fence 后 MUST NOT 开始新的文件工作阶段或 rename。所有在途与排队结果完成或拒绝后 MUST 进入 `CLOSED`。

#### Scenario: close 与新选择竞争

- **WHEN** store 从 `OPEN` 进入 `DRAINING` 的同时有新选择尝试入队
- **THEN** 状态转换原子拒绝该新工作，关闭前已排队工作仍按 FIFO 处理

#### Scenario: force 时队列仍有未开始工作

- **WHEN** 一个写入被确定性阻塞，后续工作仍在队列中，store 进入 `FORCED`
- **THEN** 后续未开始工作收到稳定拒绝且永不创建临时文件、写入或 rename

#### Scenario: force fence 后在途调用返回

- **WHEN** force fence 建立后，先前已开始的文件系统调用才返回
- **THEN** store 不开始其下一文件阶段，尤其不得开始 rename，并在结果收敛后进入 `CLOSED`

### Requirement: exit-on-select 必须只接受首个成功候选

`--exit-on-select` 模式 MUST 让第一个通过全部验证的请求原子占有选择权。占有期间其他有效选择 MUST 返回 `409 SELECTION_ALREADY_ACCEPTED`。首个请求写入失败时 MUST 释放选择权；写入成功并发送 `204` 后 MUST 停止接受新连接、排空该响应并退出 `0`。

#### Scenario: 两个有效选择竞争退出模式

- **WHEN** 第一个请求已通过验证并开始写入，第二个有效请求到达
- **THEN** 第二个请求收到稳定 `409`，只有第一个结果可写入并触发退出

#### Scenario: 首个候选写入失败

- **WHEN** 占有选择权的请求未能完成原子写入
- **THEN** 服务释放选择权并保持运行，使后续有效请求可以尝试

### Requirement: 信号关闭必须有界并保护写队列

SIGINT 或 SIGTERM MUST 立即停止接受新连接和新选择，并从同一关闭起点启动唯一预算。前 4 秒 MUST 为 `DRAINING` 优雅期；第 4 秒 MUST 建立 force fence、进入 `FORCED`、拒绝未开始工作并销毁剩余连接。第 5 秒 MUST 是包含 force 与清理阶段的绝对外层截止时间，任何阶段 MUST NOT 重置或延长它。进程 SHOULD 关闭临时文件句柄并尽力清理属于当前进程、尚未 rename 的临时文件。

#### Scenario: 空闲服务收到 SIGINT

- **WHEN** 服务没有在途写入时收到 SIGINT
- **THEN** 服务停止监听、清理自身资源并以 `130` 退出

#### Scenario: 写入期间收到 SIGTERM

- **WHEN** 已验证选择正在队列中且进程收到 SIGTERM
- **THEN** 服务拒绝新选择，在 4 秒进入 force，并在从信号起算的 5 秒绝对截止时间内以 `143` 退出；force fence 后不开始新工作或 rename

#### Scenario: 阻塞写入期间收到 SIGINT

- **WHEN** 测试以可控 seam 确定性阻塞真实子进程的文件写入并发送 SIGINT，且队列中另有未开始工作
- **THEN** 第 4 秒 force 拒绝排队工作，第 5 秒前进程以 `130` 退出，排队工作和 force 后 rename 都未发生

#### Scenario: 阻塞写入期间收到 SIGTERM

- **WHEN** 测试以可控 seam 确定性阻塞真实子进程的文件写入并发送 SIGTERM，且队列中另有未开始工作
- **THEN** 第 4 秒 force 拒绝排队工作，第 5 秒前进程以 `143` 退出，排队工作和 force 后 rename 都未发生

#### Scenario: 文件系统调用跨过绝对截止时间

- **WHEN** 极端不可中断文件系统调用无法在 5 秒截止时间内返回
- **THEN** 进程允许留下已按 `0600` 创建的本进程临时文件，但不得在 force fence 后开始新工作阶段或 rename；下次通过平台探针后、访问 manifest 或监听前按严格命名规则尽力清理

### Requirement: 生命周期回归必须确定性覆盖信号阻塞

仓库 MUST 以可控文件系统 seam 对真实子进程构造确定性阻塞写入，并 MUST 分别覆盖 SIGINT 与 SIGTERM。测试 MUST 断言 4 秒优雅期、5 秒绝对外层截止时间、未开始队列工作不执行和 force fence 后不 rename。测试 MUST NOT 依赖概率竞态、机器负载或仅靠短暂 sleep 猜测阻塞窗口。

#### Scenario: 本地和 CI 执行阻塞信号回归

- **WHEN** 维护者运行本地标准测试入口，或 CI 执行生命周期门禁
- **THEN** SIGINT 与 SIGTERM 的真实子进程阻塞写入场景都执行并通过，缺少 seam 或被跳过视为失败

### Requirement: HTTP 错误必须稳定且安全

所有 HTTP 错误 MUST 使用 `application/json; charset=utf-8` 和 `{"error":{"code":"STABLE_CODE"}}`。响应 MUST NOT 包含绝对路径、stack、Node 系统错误原文、请求头、请求体、session、manifest 内容或反馈。不存在文件与受保护文件 MUST 使用同一个 `404 NOT_FOUND`。

浏览器可能建立不携带完整请求的空闲预连接 socket。Node 报告 `ERR_HTTP_REQUEST_TIMEOUT` 时，服务 MUST 只销毁该 socket，MUST NOT 向它写入合成 `400`；其他 malformed HTTP 的 `clientError` 仍 MUST 返回一次稳定 `400 BAD_REQUEST`。

#### Scenario: 请求触发内部存储错误

- **WHEN** 原子写入因底层 I/O 失败
- **THEN** 客户端只收到稳定通用 code，响应和 stdout 都不含路径、系统错误或选择内容

#### Scenario: 空闲浏览器预连接超时

- **WHEN** Node 对没有形成完整请求的浏览器预连接报告 `ERR_HTTP_REQUEST_TIMEOUT`
- **THEN** 服务静默销毁该 socket，不生成可能与真实选择响应竞争的伪 `400`

#### Scenario: 其他 malformed HTTP 触发 clientError

- **WHEN** Node 报告非 timeout 的 HTTP 解析错误且 socket 仍可写
- **THEN** 服务发送一次稳定 `400 BAD_REQUEST` 并关闭连接

### Requirement: 安全边界和回滚必须保持诚实

实现与文档 MUST 明确说明它不防御同用户恶意本地进程，也不承诺未执行目录 fsync 时的断电持久性。迁移 MUST 先加入静态兼容 HTML 契约，再加入独立 CLI。回滚 MUST 能通过停止或删除 CLI 入口完成，MUST NOT 要求修改 starter、目标应用或 `dl-apply`；显式 HTML 属性可安全保留。

#### Scenario: 用户不再使用服务

- **WHEN** 用户停止启动或回滚独立 CLI
- **THEN** 预览 HTML 仍能按静态默认行为打开，目标应用和 design-language 注入流程不受影响

#### Scenario: 同用户进程或断电造成损失

- **WHEN** 同用户恶意进程干预目录，或 rename 后在目录项持久化前断电
- **THEN** 系统不声称已阻止该事件，文档将其列为明确剩余限制
