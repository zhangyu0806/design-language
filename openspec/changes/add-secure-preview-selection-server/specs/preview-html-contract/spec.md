## ADDED Requirements

### Requirement: 静态预览必须保持默认可用

预览 HTML MUST 是自包含、可直接通过 `file:` 打开的设计方向样机。没有启动选择服务时，页面 MUST 保持可浏览，方向按钮 MUST 只更新页面内选择状态，且 MUST NOT 发出 fetch、XHR、WebSocket 或 beacon，也 MUST NOT 声称选择已保存。

#### Scenario: 用户直接打开静态文件

- **WHEN** 用户通过 `file:` 打开符合契约的预览并点击一个方向
- **THEN** 页面更新该方向的 `aria-pressed` 与中文状态文案，不发出网络请求，也不创建持久化结果

### Requirement: 页面必须声明唯一且严格的 manifest

页面 MUST 恰好包含一个 `id="dl-preview-manifest"`、`type="application/json"` 的 script。manifest MUST 只含 `schemaVersion`、`directions` 和 `dials`，`schemaVersion` MUST 为 `1`。`directions` MUST 有 3 或 4 项，每项 MUST 只含唯一合法的 `id`、1 至 80 个 Unicode 字符的 `label` 和布尔 `recommended`，并且 MUST 恰好有一个推荐项。`dials` MUST 只含 `variance`、`motion`、`density`，值 MUST 为 0 至 100 的整数。各层 MUST 拒绝未知字段。

#### Scenario: manifest 完整且合法

- **WHEN** 页面包含 3 个唯一方向、恰好一个推荐方向和三个合法拨盘初值
- **THEN** bootstrap 接受 manifest，并以其中的 ID、名称和初值作为唯一数据来源

#### Scenario: manifest 含未知字段或重复方向

- **WHEN** manifest 含未知字段、重复 ID、非法 ID、错误数量或不唯一的推荐项
- **THEN** bootstrap 不注册持久化选择行为，并在显式状态区域显示通用中文契约错误

#### Scenario: manifest 值为 null 或字段类型错误

- **WHEN** manifest JSON 为 `null`，或 directions、direction、dials 的值不具备规定类型
- **THEN** bootstrap 不抛出异常、不发起 fetch、不注册任何事件监听器；仅当存在唯一合法状态节点时，其 `textContent` 精确变为 `预览配置无效`

#### Scenario: malformed 页面没有唯一合法状态节点

- **WHEN** manifest 非法，且状态节点缺失、重复或不满足 `[data-dl-status][aria-live="polite"]`
- **THEN** bootstrap 不抛出异常、不发起 fetch、不注册任何事件监听器，也不猜测或改写其他节点

### Requirement: 可交互节点必须使用显式 data-dl 属性

页面 MUST 有且只有一个 `[data-dl-preview]` 根元素。每个 manifest direction MUST 恰好对应一个 `<button type="button" data-dl-choice="<id>" aria-pressed="false">`，且 MUST NOT 有额外 choice。页面 MUST 恰好有一个 `[data-dl-feedback]` textarea，其 `maxlength` MUST 为 `2000`；MUST 恰好有三个范围为 0 至 100、步长为 1 的 `[data-dl-dial]` input；还 MUST 恰好有一个 `[data-dl-status][aria-live="polite"]`。

#### Scenario: DOM 与 manifest 一一对应

- **WHEN** 每个方向、反馈、三个拨盘和状态区域都通过规定属性唯一声明
- **THEN** bootstrap 只绑定这些节点，且三个拨盘初值与 manifest 一致

#### Scenario: DOM 缺失或出现重复声明

- **WHEN** choice 与 manifest 不一致，或反馈、拨盘、状态节点缺失或重复
- **THEN** bootstrap 保留静态展示但禁用持久化选择，并显示通用中文契约错误

### Requirement: bootstrap 不得猜测 DOM 含义

bootstrap MUST 只使用固定 manifest ID 和 `data-dl-preview`、`data-dl-choice`、`data-dl-feedback`、`data-dl-dial`、`data-dl-status`。它 MUST NOT 根据标签文案、CSS class、卡片结构、父子位置、节点顺序或视觉内容推断方向及控件。

#### Scenario: 页面类名和布局发生变化

- **WHEN** 设计者改变卡片类名、嵌套层级、展示顺序或按钮可见文案，但保留显式契约
- **THEN** bootstrap 仍按 manifest ID 与 `data-dl-*` 值准确绑定，不读取其他 DOM 线索

### Requirement: 服务增强必须经严格运行环境启用

bootstrap MUST 仅在协议为 `http:`、hostname 精确为 `127.0.0.1` 且 manifest/DOM 均合法时，同源请求 `GET /__dl/session`。获得合法 session 后，choice 点击 MUST 向相对 URL `/__dl/select` 发送 schema version、session、choice、反馈和三个拨盘。其他协议、hostname 或失败状态 MUST 回退为静态行为。

#### Scenario: 页面由官方本机服务提供

- **WHEN** 合法页面从 `http://127.0.0.1:<port>/` 加载且 session 请求成功
- **THEN** 点击显式 choice 会向同源 `/__dl/select` 提交严格选择对象，并根据结果更新中文状态

#### Scenario: 页面由 localhost 或其他来源提供

- **WHEN** 同一页面从 `localhost`、其他 hostname、HTTPS 或非 HTTP 协议加载
- **THEN** bootstrap 不请求 session 或选择 API，只保留静态页面内选择

#### Scenario: 选择响应精确为 204

- **WHEN** 合法同源选择请求收到 HTTP `204`
- **THEN** bootstrap 先完整消费该 response，再显示中文保存成功状态

#### Scenario: 选择响应是其他成功状态

- **WHEN** 选择请求收到 `200`、`201` 或其他非 `204` 状态，包括其他 2xx
- **THEN** bootstrap 不显示保存成功，并按安全失败路径保留样机与用户输入

### Requirement: 客户端错误必须安全且不破坏预览

manifest、DOM、session、网络或 API 失败时，页面 MUST 保持设计内容可浏览。状态区域 MUST 使用通用中文提示，MUST NOT 展示响应原文、绝对路径、stack、session、请求体或用户反馈。

#### Scenario: 选择 API 返回错误

- **WHEN** 持久化请求失败或返回非成功状态
- **THEN** 页面保留当前样机与用户输入，显示安全的中文失败提示，不输出敏感诊断内容

### Requirement: 真实 Chromium 回归必须证明浏览器契约

仓库 MUST 拥有真实 Chromium E2E，并 MUST 在本地标准测试入口与 CI 中执行。E2E MUST 覆盖 `file:` 静态模式、官方回环服务模式、malformed manifest 零副作用、精确 `204` response 消费以及选择后的可见状态。HTML 发现测试 MUST 以真实 Chrome 做差分基准，证明 manifest `id`、`type` 和 MathML `annotation-xml[encoding]` 按浏览器 tokenizer 行为解码字符引用后比较，同时证明 JSON script text 从不做 entity 解码。测试 MUST 分开提供网络诊断控制与浏览器门禁元控制。fetch-abort 网络诊断控制 MUST 在真实 Chrome 中确认被中止请求产生对应的 `Network.loadingFailed`，它 MUST NOT 被当作浏览器门禁失败证明。浏览器门禁元控制 MUST 由外层测试运行正常和中止两个内层子进程场景；两者 MUST 调用同一个实际生产预览 E2E helper 与流程，启动生产 CLI、加载符合契约的 HTML、等待 session 与 DOM ready，并通过真实页面交互发出实际选择 POST。正常内层 MUST 继续观察精确 `204`、对应的 `Network.loadingFinished`、页面成功状态和 mode `0600` 的持久化结果，再以 `0` 退出。中止内层 MUST 在同一实际选择请求触发 `Network.requestWillBeSent` 后，通过测试层 `Fetch` pause 保持请求，再杀死 Chrome，并以非零状态退出。通用 data URL、孤立 CDP promise 或绕过生产 CLI/bootstrap 的合成请求 MUST NOT 充当元控制。外层测试 MUST 仅在正常内层为零且中止内层为非零时通过。Chrome/Chromium MUST 只作为测试基础设施，MUST NOT 成为预览页或服务的运行时 npm 依赖。Ubuntu 24.04 CI MUST 将 action 输出经 `readlink -f` 解析并精确匹配 `/opt/hostedtoolcache/setup-chrome/chrome/144.0.7559.109/x64/chrome`，再为该无通配符的唯一可执行路径加载仅含 `userns` 权限的专用 AppArmor profile，保持 Chrome sandbox 启用；MUST NOT 使用 `--no-sandbox`、setuid helper、全局 AppArmor userns sysctl 降级、禁用 AppArmor 或宽路径规则。

#### Scenario: 本地和 CI 执行浏览器门禁

- **WHEN** 维护者运行本地标准测试入口，或 CI 执行变更门禁
- **THEN** 仓库自有 E2E 启动真实 Chromium 并完成静态与服务场景，未安装或未启动浏览器不得被当作通过

#### Scenario: Ubuntu 24.04 运行下载版 Chrome for Testing

- **WHEN** CI 使用 action 下载的固定 CfT 144.0.7559.109 执行真实浏览器门禁
- **THEN** CI 只对解析并验证后的精确可执行路径授予 AppArmor `userns`，Chrome sandbox 保持启用；路径漂移或需要全局安全降级时门禁失败

#### Scenario: fetch-abort 只证明网络监控有效

- **WHEN** 真实 Chrome 中的诊断控制发出慢 fetch 并通过 AbortController 中止该请求
- **THEN** CDP 观察到同一 request id 的 `Network.loadingFailed`，且该结果只确认网络事件监控链，不代替浏览器门禁失败控制

#### Scenario: 外层元控制证明浏览器门禁有效

- **WHEN** 外层测试让正常和中止内层通过同一生产预览 helper 启动生产 CLI、加载合规 HTML、等待 session/DOM ready，并发出实际选择 POST；正常内层继续运行，中止内层在该请求的 `Network.requestWillBeSent` 后于测试层 `Fetch` pause 并杀死 Chrome
- **THEN** 正常内层观察精确 `204`、对应 `Network.loadingFinished`、页面成功状态和 mode `0600` 持久化后以 `0` 退出，中止内层以非零状态退出；外层断言仅在两项同时成立时通过，任何跳过、未启动、合成替代场景或中止后静默成功都使元控制失败
