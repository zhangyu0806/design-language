## ADDED Requirements

### Requirement: 现有 CLI 调用保持兼容
`dl-apply` MUST 继续接受 `dl-apply <目录> [preset]` 与 `dl-apply --check <目录> [preset]`，未提供 preset 时 MUST 使用 `dark`，未提供 `--modules` 时 MUST 使用空模块集合，并且 MUST 继续默认注入 `STYLE_PREVIEW.md`。

#### Scenario: 旧 apply 调用
- **WHEN** 使用者运行 `dl-apply <目录> editorial`
- **THEN** 命令按 `editorial` preset 和空模块集合生成受管区块，并包含 `STYLE_PREVIEW.md`

#### Scenario: 旧 check 调用
- **WHEN** 使用者运行 `dl-apply --check <目录>`
- **THEN** 命令以 `dark` preset、空模块集合和默认 `STYLE_PREVIEW.md` 检查目标

### Requirement: modules 参数解析
`dl-apply` MUST 接受 `--modules <逗号分隔列表>`，仅允许 `ui-patterns`、`motion`、`data-vis`、`preferences`，MUST 去除重复 ID，并 MUST 按注册表规范顺序生成模块集合。未知 ID、缺失参数或未知选项 MUST 返回退出码 `1` 且不得修改目标文件。

#### Scenario: 多模块规范化
- **WHEN** 使用者传入 `--modules data-vis,ui-patterns,data-vis`
- **THEN** 命令使用 `ui-patterns,data-vis` 作为规范化模块集合，并按该顺序注入且每个模块只出现一次

#### Scenario: 未知模块
- **WHEN** 使用者传入包含 `unknown` 的模块列表
- **THEN** 命令返回退出码 `1`，报告未知模块，并保持目标文件不变

### Requirement: 受管区块使用确定性内容
`dl-apply` MUST 从同一规范化生成过程构造 apply 和 check 的期望区块，区块 MUST 包含所选 preset、规范化模块集合、完整核心契约、完整 `STYLE_PREVIEW.md`、按注册表顺序排列的所选模块和完整 preset 内容。

#### Scenario: 相同配置生成相同区块
- **WHEN** 两次调用使用相同 preset 和逻辑上相同但输入顺序不同的模块集合
- **THEN** 两次生成的受管区块逐字节相同

### Requirement: check 执行严格完整比较
`dl-apply --check` MUST 只读目标文件，并 MUST 同时验证标记结构、preset、规范化模块集合、模块顺序和全部上游内容。仅当目标中的唯一完整受管区块与期望区块逐字节相等时，命令 MUST 返回 `0`。

#### Scenario: 完全匹配
- **WHEN** 目标包含唯一完整区块，且 preset、模块集合、顺序和全部上游字节均与期望一致
- **THEN** check 返回退出码 `0`，且目标文件字节与权限保持不变

#### Scenario: preset 不匹配
- **WHEN** 目标区块完整但记录或包含的 preset 与检查参数不同
- **THEN** check 返回退出码 `2`，且不修改目标文件

#### Scenario: 模块集合不匹配
- **WHEN** 目标区块完整但模块集合或模块顺序与规范化期望不同
- **THEN** check 返回退出码 `2`，且不修改目标文件

#### Scenario: 上游内容过期
- **WHEN** 目标区块完整但任一核心、风格预览、模块或 preset 字节与当前上游内容不同
- **THEN** check 返回退出码 `2`，且不修改目标文件

### Requirement: 退出码语义稳定
`dl-apply` MUST 使用退出码 `0` 表示 apply 成功或 check 完全匹配，MUST 使用退出码 `2` 表示目标缺少受管区块或完整区块与期望不匹配，并 MUST 使用退出码 `1` 表示参数、源文件、权限或标记结构错误。

#### Scenario: 缺少区块
- **WHEN** check 读取到不存在受管区块的目标文件
- **THEN** 命令返回退出码 `2`

#### Scenario: 调用错误
- **WHEN** 调用缺少目标目录参数或指定未知 preset
- **THEN** 命令返回退出码 `1` 且不修改任何目标文件

#### Scenario: apply 成功
- **WHEN** apply 使用合法参数成功创建或刷新受管区块
- **THEN** 命令返回退出码 `0`

### Requirement: 损坏标记必须拒绝写入
`dl-apply` MUST 仅接受完全无标记或恰好一个起始标记后跟一个结束标记的目标。只有单边标记、顺序颠倒、重复起始标记、重复结束标记或多个标记对时，apply 和 check MUST 返回 `1`，apply MUST 在任何写入前停止。

#### Scenario: 只有起始标记
- **WHEN** 目标文件包含起始标记但不包含结束标记
- **THEN** 命令返回退出码 `1`，apply 保持目标文件逐字节不变

#### Scenario: 标记顺序颠倒
- **WHEN** 目标文件中的结束标记位于起始标记之前
- **THEN** 命令返回退出码 `1`，且不尝试替换区块

#### Scenario: 重复标记
- **WHEN** 目标文件包含重复标记或多个完整标记对
- **THEN** 命令返回退出码 `1`，apply 保持目标文件逐字节不变

#### Scenario: 近似但损坏的标记
- **WHEN** 目标文件包含带缩进、尾随空格或其他轻微改写的 design-language HTML 标记行
- **THEN** 命令返回退出码 `1`，且不得把目标误判为无标记后追加新区块

### Requirement: apply 保持幂等
`dl-apply` MUST 在相同输入下产生稳定文件。对已匹配目标再次 apply MUST 保持整个文件逐字节不变，且不得重复追加模块或受管区块。

#### Scenario: 连续两次应用
- **WHEN** 使用者以相同 preset 和模块集合连续运行两次 apply
- **THEN** 第二次运行后的目标文件与第一次运行后的目标文件逐字节相同，且仅有一个受管区块

### Requirement: apply 保留非受管字节和 Unix mode bits
创建或替换受管区块时，`dl-apply` MUST 保留区块外全部既有字节，并 MUST 保留既有 `AGENTS.md` 的 Unix mode bits。目标文件不存在时，命令 MUST 只创建 `AGENTS.md`，不得写入其他项目文件。ACL、xattr、SELinux label 等扩展元数据不属于跨平台契约。

#### Scenario: 替换已有区块
- **WHEN** 目标 `AGENTS.md` 在完整受管区块前后包含用户维护内容并具有既有权限
- **THEN** apply 只替换标记范围内的字节，区块外字节和 Unix mode bits 保持不变

#### Scenario: 非当前用户文件
- **WHEN** 现有 `AGENTS.md` 不属于当前运行用户
- **THEN** apply 返回退出码 `1` 并拒绝修改；调用者不得通过 `sudo` 绕过该边界

#### Scenario: 创建新目标文件
- **WHEN** 目标目录不存在 `AGENTS.md`
- **THEN** apply 创建包含受管区块的 `AGENTS.md`，且不修改目标项目的 CSS、HTML、字体或应用源码

#### Scenario: 保留独立偏好记录
- **WHEN** 目标项目存在 `DESIGN_PREFERENCES.md` 并刷新 preset 或模块集合
- **THEN** apply 仅管理 `AGENTS.md`，`DESIGN_PREFERENCES.md` 保持逐字节不变

### Requirement: CLI 不产生额外运行依赖或服务
`dl-apply` MUST 只使用仓库已有的 Bash 和标准系统工具，MUST NOT 启动预览服务器、监听器或后台进程，也 MUST NOT 安装或要求新的外部依赖。

#### Scenario: 应用包含全部模块
- **WHEN** 使用者选择四个模块运行 apply
- **THEN** 命令完成静态区块写入后退出，不启动常驻进程、不安装依赖，也不修改 CSS、HTML、字体或应用源码
