## ADDED Requirements

### Requirement: 核心设计契约保持精简且完整
系统 MUST 在默认核心契约中保留共享 DNA、NEVERS、三拨盘、规则优先级、页面级功能契约和最小交付门禁，同时 MUST 将专项指导留在可选模块中，避免默认上下文包含未选择的专项内容。

#### Scenario: 默认核心内容
- **WHEN** 使用者在未选择任何可选模块的情况下应用设计语言
- **THEN** 注入内容包含共享 DNA、NEVERS、三拨盘、规则优先级、页面级功能契约和最小交付门禁，且不包含四个可选模块正文

### Requirement: 四个模块显式启用
系统 MUST 只提供 `ui-patterns`、`motion`、`data-vis`、`preferences` 四个可选模块 ID，并且 MUST 仅在调用者显式选择对应 ID 时加入模块正文。

#### Scenario: 选择部分模块
- **WHEN** 调用者仅选择 `motion` 和 `preferences`
- **THEN** 生成内容包含动效与偏好治理模块，不包含功能型 UI 和数据可视化模块

#### Scenario: 未选择模块
- **WHEN** 调用者不提供模块选择
- **THEN** 生成内容不包含任何可选模块正文

### Requirement: 风格预览保持默认契约
系统 MUST 在是否选择可选模块的所有情况下默认包含 `STYLE_PREVIEW.md`，并且 MUST 保持其位于核心设计契约与 preset 指导之间的既有角色。

#### Scenario: 无模块时保留风格预览
- **WHEN** 调用者使用兼容旧语法且不选择模块
- **THEN** 生成内容仍包含完整 `STYLE_PREVIEW.md`

#### Scenario: 有模块时保留风格预览
- **WHEN** 调用者选择一个或多个模块
- **THEN** 生成内容包含完整 `STYLE_PREVIEW.md`，且模块选择不会关闭或替换它

### Requirement: 规范注册表顺序
系统 MUST 以 `ui-patterns`、`motion`、`data-vis`、`preferences` 作为唯一规范模块顺序，并且相同模块集合 MUST 生成相同顺序，不受调用者输入顺序或重复 ID 影响。

#### Scenario: 逆序且重复输入
- **WHEN** 调用者按 `preferences,motion,preferences,ui-patterns` 选择模块
- **THEN** 输出只包含一次 `ui-patterns`、一次 `motion` 和一次 `preferences`，顺序为 `ui-patterns`、`motion`、`preferences`

### Requirement: 根目录与 starter 镜像字节一致
系统 MUST 让根目录中的核心设计文件、风格预览文件、preset 文件和四个模块文件与 `starter/.ai/` 中对应文件保持 byte-for-byte 一致，并且 CI MUST 对所有对应关系执行字节比较。

#### Scenario: 所有镜像同步
- **WHEN** CI 比较根目录与 `starter/.ai/` 的全部受管设计文件
- **THEN** 每一对对应文件都逐字节相等，检查返回成功

#### Scenario: 任一镜像漂移
- **WHEN** 任一 starter 副本与根目录来源存在一个或多个字节差异
- **THEN** CI 镜像检查失败并阻止该变更通过

### Requirement: 模块化指导不扩展运行表面
系统 MUST NOT 实现预览服务器、监听器或后台进程，MUST NOT 引入外部依赖，并且 MUST NOT 自动修改目标项目的 CSS、HTML、字体或应用源码。

#### Scenario: 应用模块化指导
- **WHEN** 使用者将核心契约和任意模块应用到目标项目
- **THEN** 系统只管理目标 `AGENTS.md` 中的设计语言区块，不启动服务，不安装依赖，也不修改 CSS、HTML、字体或应用源码

### Requirement: 项目偏好记录位于受管区块之外
`preferences` 模块 MUST 只提供治理规则和空模板，实际项目偏好 MUST 写入目标项目根目录的 `DESIGN_PREFERENCES.md`，并且 `dl-apply` MUST NOT 创建、修改或删除该文件。

#### Scenario: 刷新偏好模块
- **WHEN** 项目已有 `DESIGN_PREFERENCES.md`，调用者加入或移除 `preferences` 模块并重跑 apply
- **THEN** `DESIGN_PREFERENCES.md` 保持逐字节不变
