## Why

当前设计语言已经覆盖个人 DNA、反 AI slop、风格试衣间和基础交付门禁，但所有规则持续堆入默认上下文会放大 prompt、模糊核心职责，也仍缺少功能型 UI、动效、数据可视化和偏好治理的专项决策规则。第二阶段需要把“每个项目都必须遵守的核心契约”与“按任务加载的专业参考”分开，并让 `dl-apply` 能以稳定、可验证的方式选择模块。

## What Changes

- 在核心 `DESIGN.md` 中补充页面级功能契约，并保留共享 DNA、NEVERS、三拨盘、规则优先级和最小交付门禁。
- 新增四个中文可选参考模块：功能型 UI 模式、动效工艺、数据可视化、项目偏好治理。
- `STYLE_PREVIEW.md` 继续作为默认注入内容，保持现有调用行为；本阶段不实现预览服务器或后台进程。
- 扩展 `dl-apply`，支持 `--modules` 选择一个或多个模块，并以固定顺序去重、幂等注入。
- 强化 `--check`：除检查标记存在外，还要验证 preset、模块集合和上游内容均与期望完全一致。
- 保持根目录与 `starter/.ai/` 镜像 byte-for-byte 一致，并通过测试和 CI 防止漂移。
- 增加无外部依赖的 Bash 行为测试，覆盖旧调用兼容、模块解析、幂等更新、严格检查和损坏标记保护。
- 更新 README、USAGE、starter 指令和 Graphify 图谱，说明模块按需加载，避免默认 prompt 膨胀。

## Capabilities

### New Capabilities

- `modular-design-contract`: 定义核心设计契约、四个按需参考模块、默认风格预览协议和根/starter 镜像要求。
- `dl-apply-modules`: 定义 `dl-apply --modules` 的 CLI、规范化注入、严格检查、幂等性和安全标记行为。

### Modified Capabilities

无。仓库目前没有已发布的 OpenSpec capability。

## Impact

- 核心规范与镜像：`DESIGN.md`、`STYLE_PREVIEW.md`、`starter/.ai/`。
- 新增模块：`references/` 与 `starter/.ai/references/`。
- CLI 与测试：`scripts/dl-apply.sh`、`scripts/dl-apply-registry.sh`、`tests/`。
- 文档与 CI：`README.md`、`USAGE.md`、`starter/README.md`、`starter/CLAUDE.md`、`.github/workflows/ci.yml`。
- 图谱：`graphify-out/GRAPH_REPORT.md`、`graphify-out/graph.json`。
- 无新增运行时依赖，不修改目标项目的 CSS、HTML、字体或应用源码。
- 现有 `dl-apply <目录> [preset]` 与 `dl-apply --check <目录> [preset]` 调用保持兼容。
