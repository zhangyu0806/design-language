## Why

静态风格试衣间已经能展示方向，但用户选中方向后仍需人工转述和记录，缺少可验证、可被后续 agent 消费的选择闭环。最终审查还证明，持久服务若在无法证明文件描述符 containment 的平台运行、以文本搜索发现 manifest，或在强制关闭后继续启动排队写入，会把便利功能变成安全与数据一致性风险。需要在保留跨平台 `file:` 默认体验的同时，把可持久化服务收窄为 Linux/WSL2 上证据充分、关闭有界、可由真实 Chromium 回归的可选工具。

## What Changes

- 新增无运行时外部依赖的 Node 22 预览选择服务，仅支持 Linux/WSL2，仅绑定 `127.0.0.1`，默认由系统分配端口，不提供 host、自动打开、daemon、watch、tunnel 或公共分享能力。
- 服务在读取用户预览根目录、监听或写入前验证 `/proc/self/fd` 可用；平台不支持或验证失败时仅输出稳定私有启动错误并退出。跨平台默认能力仍是直接通过 `file:` 打开静态预览。
- 新增严格 HTML 契约：页面通过唯一 JSON manifest 和显式 `data-dl-*` 属性声明 3–4 个方向、三拨盘、反馈与状态区域；服务和客户端不猜测任意 DOM。
- 新增静态安全服务：真实路径约束、路径穿越/符号链接逃逸/dotfile/选择结果保护、GET/HEAD 与 MIME 白名单。
- 新增选择 API：Host/Origin、请求方法、媒体类型、32 KiB body、session、choice、反馈和三拨盘验证；不返回 CORS 许可头。
- 选择结果以 `0600` 权限原子写入预览目录的 `selection.json`；每次启动生成新 session，旧结果不会被误认作当前选择。
- 生产源码按七个不超过 250 纯 LOC 的模块拆分，HTML manifest 发现与关闭生命周期各有独立模块。
- 支持 `--exit-on-select`、显式 `OPEN/DRAINING/FORCED/CLOSED` FIFO 存储状态、SIGINT/SIGTERM 单一关闭预算和稳定 JSON ready/error 输出；不泄露绝对路径、stack、请求体或反馈。
- 新增真实 HTTP、原始 socket、确定性阻塞写入信号测试、进程生命周期与原子存储测试；仓库自有真实 Chromium E2E 在本地和 CI 都是必过门禁，并包含可证明测试有效的故意中止控制。
- 更新 `STYLE_PREVIEW.md` 和使用文档：静态、自包含 HTML 仍是默认；预览服务只是从 design-language checkout 显式启动的可选增强。
- 不修改 starter 应用源码、依赖、锁文件或目标项目源码；`dl-apply` 不复制、启动或安装该服务。

## Capabilities

### New Capabilities

- `preview-html-contract`: 定义静态兼容的预览 manifest、显式选择按钮、中文反馈、三拨盘和客户端启动契约。
- `preview-selection-server`: 定义 loopback-only CLI、安全静态服务、选择 API、原子落盘、session 隔离和进程生命周期。

### Modified Capabilities

无。已完成的 `phase-two-modular-guidance` 保持历史不变，本变更新增独立 capability。

## Impact

- 新增脚本：`scripts/dl-preview-*.mjs`，生产架构固定为七个职责单一模块。
- 新增测试：`tests/dl-preview-*.test.mjs` 与测试 fixture helper。
- 更新协议与文档：`STYLE_PREVIEW.md`、starter 镜像、README、USAGE、starter 指令。
- 更新 CI、Graphify 和 CodeGraph 索引边界。
- 运行要求：Linux/WSL2、Node.js 22 和可用的 `/proc/self/fd`；无新增运行时 npm/Bun 依赖，无根 `package.json`。Chrome 只属于测试基础设施。
- 安全边界：当前用户拥有的可信预览目录；保留严格 Host、Origin、请求帧、`0600`、session、静态路径约束；不防御恶意同用户本地进程，不承诺断电后的目录 fsync 持久性。
- 关闭边界：信号后 4 秒优雅期、5 秒绝对外层截止时间；极端不可中断文件系统停顿可能留下已按 `0600` 创建的临时文件，由下次启动尽力清理，但 force fence 后不得开始新工作或 rename。
