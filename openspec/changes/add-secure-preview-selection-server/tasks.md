## 1. 契约与测试基线

- [x] 1.1 新增合法/非法预览 fixture helper，并确认 manifest/selection 单元测试在实现前红灯
- [x] 1.2 新增静态路径与原子存储测试，并确认穿越、保护文件、symlink 和失败清理在实现前红灯
- [x] 1.3 新增真实 HTTP/raw socket/进程生命周期测试，并确认服务实现前红灯
- [x] 1.4 新增 null/字段类型错误 manifest 的客户端零异常、零网络、零监听器测试，并断言仅唯一合法状态节点精确显示 `预览配置无效`
- [x] 1.5 新增活动 DOM 等价 HTML 发现测试，覆盖注释、template、raw-text/RCDATA、外来命名空间、malformed 和多候选拒绝
- [x] 1.6 新增可控阻塞写入 seam 的真实子进程 SIGINT/SIGTERM 测试，断言 4 秒 force、5 秒绝对截止、队列不启动和 force 后不 rename

## 2. Manifest、路径与选择存储

- [x] 2.1 实现严格 manifest 与选择 schema 解析，并修复 malformed 客户端输入的零副作用与精确通用状态契约
- [x] 2.2 实现 realpath containment、保护路径、MIME 和文件描述符静态读取
- [x] 2.3 将 FIFO 存储改为 `OPEN/DRAINING/FORCED/CLOSED` 显式状态，保证 close 拒绝新工作、force 后未开始工作不启动且不 rename
- [x] 2.4 实现无运行时依赖的专用 HTML 发现模块，只接受恰好一个活动 DOM 等价 manifest

## 3. 浏览器与 HTTP 服务

- [x] 3.1 修复静态安全 bootstrap，对 malformed manifest 不抛错、不请求、不注册监听器且不猜测状态节点
- [x] 3.2 实现固定路由矩阵、安全响应头、Host/Origin/no-CORS 与请求帧限制
- [x] 3.3 实现随机 session、正常模式并发选择和 `--exit-on-select` 首选占有语义
- [x] 3.4 将客户端成功条件收窄为精确 `204`，并在显示保存成功前完整消费 response

## 4. CLI 与生命周期

- [x] 4.1 将持久 CLI 收窄为 Linux/WSL2，并在用户根目录访问、监听、清理或写入前验证可用 `/proc/self/fd`，失败仅输出稳定私有启动错误
- [x] 4.2 将 SIGINT/SIGTERM 生命周期改为单一预算，4 秒优雅期和包含 force 的 5 秒绝对外层截止时间
- [x] 4.3 建立仓库自有真实 Chromium E2E，在本地和 CI 必跑，并加入故意中止控制证明门禁会失败
- [x] 4.4 将生产架构从五个模块拆为七个不超过 250 纯 LOC 的模块，新增专用 HTML 发现与生命周期模块

## 5. 文档与持续集成

- [x] 5.1 更新 `STYLE_PREVIEW.md` 与 starter 镜像，补充跨平台静态默认、Linux/WSL2 服务和严格客户端失败协议
- [x] 5.2 更新 README、USAGE、scripts/starter 说明，补充 `/proc/self/fd` 启动前置、关闭预算和临时文件剩余风险
- [x] 5.3 将真实 Chromium E2E、故意中止控制及确定性阻塞写入 SIGINT/SIGTERM 回归接入本地标准入口和 CI，不增加运行时依赖

## 6. 最终门禁与同步

- [x] 6.1 重新运行 OpenSpec strict、七模块源码行数、完整测试、真实 Chromium、阻塞信号回归、starter build、CodeGraph affected 和 Graphify update
- [x] 6.2 执行 Goal/Code/Security/QA/Context 五路终审并修复全部 blocker
- [x] 6.3 原子提交、推送 main，并确认 GitHub Actions 成功
