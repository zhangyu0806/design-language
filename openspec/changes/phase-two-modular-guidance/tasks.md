## 1. 测试与安全基线

- [x] 1.1 记录并保护现有未跟踪 `scripts/__pycache__`，将通用 Python cache 规则加入 `.gitignore`
- [x] 1.2 新增根/starter 文档 byte-for-byte 同步测试
- [x] 1.3 新增 `dl-apply` 旧语法、模块解析、严格 check、幂等和损坏标记保护测试，并确认实现前按预期失败

## 2. 核心与可选参考模块

- [x] 2.1 精简核心 `DESIGN.md`，补充页面功能契约和可选模块路由
- [x] 2.2 新增中文 `UI_PATTERNS.md`、`MOTION.md`、`DATA_VIS.md`、`PREFERENCES.md`
- [x] 2.3 同步 `starter/.ai/` 镜像并通过字节一致性测试

## 3. 模块化注入 CLI

- [x] 3.1 为 `dl-apply` 实现兼容旧语法的 `--modules` 参数解析、去重和固定顺序
- [x] 3.2 让 apply/check 共用期望区块，并实现 preset、模块和上游内容严格比较
- [x] 3.3 拒绝畸形或重复标记，保持非受管内容、文件权限与重复执行幂等
- [x] 3.4 运行完整 Bash 测试并修复所有回归

## 4. 文档与持续集成

- [x] 4.1 更新 README、USAGE、starter README 和 CLAUDE 指令，说明模块按需加载和兼容语法
- [x] 4.2 将文档同步测试与 CLI 行为测试接入 GitHub Actions
- [x] 4.3 运行 OpenSpec strict、文档同步、CLI 测试与 starter 生产构建

## 5. 图谱与最终审核

- [x] 5.1 更新 Graphify 图谱并确认未提交 cache
- [x] 5.2 审核完整 diff、工作树范围和未跟踪缓存保护状态
