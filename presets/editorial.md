# Preset: editorial — AI 喂养片段

> 用法：项目用 editorial 风格时，把本片段连同 `DESIGN.md` 一起放进 AI 上下文。

## 一句话
克制、精准、可信的编辑感设计，像 Stripe / 高级杂志。serif 标题 + 大量留白 + 非对称网格。

## 适用
SaaS、文档站、专业工具、后台、需要"靠谱"气质的产品。

## 颜色（亮色，OKLCH）
| 角色 | 值 | 直觉 |
|---|---|---|
| 背景 | `oklch(0.99 0.005 90)` | 暖白（非纯白） |
| 表面 | `oklch(1 0 0)` | 白卡片 |
| 正文 | `oklch(0.25 0.01 60)` | 墨黑偏暖（非纯黑） |
| 次要文字 | `oklch(0.5 0.01 60)` | 中灰 |
| 边框 | `oklch(0.88 0.008 80)` | 浅暖灰 |
| 主色 accent | `oklch(0.45 0.08 250)` | 深墨蓝（**非 blue-500**） |
| CTA | `oklch(0.68 0.15 55)` | 暖赭橙 |

Tailwind 类：`bg-bg text-text bg-accent text-cta`（语义类，无默认色）。

## 字体
- 英文标题：**Fraunces**（serif，有性格）
- 英文正文：**Geist**
- 中文标题：**思源宋体 Noto Serif SC**
- 中文正文：**思源黑体 Noto Sans SC**
- fallback：`"PingFang SC","Microsoft YaHei"`（黑）/ `"Songti SC","SimSun"`（宋）

## 质感
- 圆角分级：按钮 4 / 输入 6 / 卡片 10 / 容器 2（DNA-2）
- 阴影：极淡，主要靠 1px 边框和明度对比说话
- 标题 weight 500–600，靠字号行高扛重量

## 招牌动作（写出来要像这样）
- 标题用 serif，配大量留白
- 布局非对称：`grid-template-columns: 3fr 5fr`
- CTA 用赭橙，主色蓝用于链接/强调
- hover 微妙，用招牌缓动 `cubic-bezier(0.22,1,0.36,1)`

## 页面指纹
- Hero 像编辑导语：左侧短标题 + 右侧解释/索引/真实截图，不做大居中口号。
- Section 之间靠留白和细边界分层，少用重卡片；表格/列表要像出版物目录，有明确层级。
- 数据展示用克制数字 + 文字解释，不用渐变大数字。
- 适合文档、专业工具时，优先清晰信息架构，不追求炫技动效。

## 本 preset 禁忌
- 不要把 editorial 误解成“到处 serif + 复古杂志拼贴”。中文正文仍以清晰黑体为主。
- 不要用大面积暖米色 + 赭橙把它做成 warm；editorial 的底色应更冷静、更精准。
- 不要每个 section 都加小大写 eyebrow；编辑感来自节奏，不来自标签堆叠。

## 参考点
像 **Stripe 文档**、**Linear 早期**、**高级印刷杂志**。
**不像** 一般 SaaS 落地页、Vercel 模板、紫渐变 hero。
