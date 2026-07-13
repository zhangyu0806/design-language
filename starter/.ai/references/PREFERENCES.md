# PREFERENCES.md：项目级偏好治理模板

> 可选模块 `preferences`。这是治理说明和空模板，不包含任何个人、品牌或团队偏好。实际项目记录必须写入项目根目录的 `DESIGN_PREFERENCES.md`，位于 `dl-apply` 受管区块之外。

## 使用边界

- 不从沉默、一次性草稿或外部品牌风格推断偏好。
- 不把 `DESIGN.md` 的通用 DNA 重抄成项目偏好。
- 不在 `AGENTS.md` 的 `<!-- BEGIN design-language -->` 受管区块内填写实际记录；重跑 `dl-apply` 会刷新该区块。
- 不记录密码、token、个人身份信息或未经授权的内部材料。
- 用户明确要求优先，但不能覆盖安全、可访问性、真实业务信息及法律、价格、隐私文案。
- 每条偏好必须可追溯、可替代、可复查；失效后删除或标记废止，不无限累积。

## 偏好记录

在项目根目录创建或维护 `DESIGN_PREFERENCES.md`，复制以下区块新增记录。该文件不由 `dl-apply` 管理，切换 preset、模块或刷新上游规范时不会被覆盖。当前模板故意不填写任何实际偏好。

```text
Preference:
Rule:
Level: 硬禁令 / 强偏好 / 情境规则
Scope:
Evidence:
Supersedes:
Propagated:
Rechecked:
Owner:
Status: active / superseded / retired
```

### 字段说明

- **Scope**：适用项目、页面、组件、平台或情境。禁止写“全部”却不给边界。
- **Evidence**：用户原话、批准记录、可复现观察或正式项目决策。只写来源上下文，不复制敏感内容。
- **Supersedes**：本条替代的旧记录 ID；没有则写“无”。
- **Propagated**：已同步到哪些项目文件、检查清单或组件规范；没有则写“未传播”。
- **Rechecked**：最近一次与用户或项目现状复核的日期和结果。

## 治理流程

1. 捕获：先保存证据，不把猜测写成规则。
2. 定界：填写 Scope，确认它是项目偏好还是一次性要求。
3. 冲突检查：按 `DESIGN.md` 规则优先级判断，记录取舍。
4. 传播：只同步到 Scope 覆盖的位置，并填写 Propagated。
5. 复查：页面重构、品牌变化或证据冲突时更新 Rechecked。
6. 替代或退役：新规则出现时填写 Supersedes，保留可审计关系，不让两条冲突规则同时 active。

## 空模板自检

- [ ] 没有预填任何个人偏好、品牌规则或外部身份内容
- [ ] 每条新增记录都有 Scope / Evidence / Supersedes / Propagated / Rechecked
- [ ] 证据可追溯，范围具体，没有把猜测写成事实
- [ ] 冲突记录按核心规则优先级处理，旧规则已替代或退役
