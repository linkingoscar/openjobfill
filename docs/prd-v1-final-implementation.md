# OpenJobFill PRD v1 — 最终实现与验收边界

> 本文用于把 PRD v1 的 P0/P1 要求映射到当前实现，并明确哪些验收可以由自动化开发环境证明，哪些必须由本人登录真实招聘站点完成。它不替代原 PRD。

## 1. 产品边界

本分支把 OpenJobFill 从“尽可能多填”的自动化工具改造成“可信档案 + 风险预览 + 用户确认 + 严格读回”的个人求职助手。

不可越过的边界：

- 不自动填写密码、验证码、支付/财务敏感控件；
- 不自动登录、注册、提交申请、确认提交、进入下一步、删除或撤回；
- AI 不拥有自由 DOM/JS 执行权；
- AI 字段映射不接收档案实际值；
- 完整简历、开放题上下文、岗位版本事实摘要发送给模型前必须由用户逐次确认；
- fixture、CI、静态页面和匿名浏览不能把站点标记为 `PERSONAL_VERIFIED`。

## 2. P0 实现映射

### 2.1 Resume Schema v5 / 可信档案

实现：

- 字段级 `source / confidence / evidence / confirmed / locked / updatedAt / autoFillEnabled`；
- v4 → v5 迁移和严格 schema 解析；
- `__proto__ / prototype / constructor` 路径段拒绝；
- Profile Center 可人工确认、锁定和关闭单字段自动填写；
- parser/AI 导入不得静默覆盖锁定或已确认事实。

### 2.2 Master Profile + Job Variant

岗位版本不是整份事实副本，而是 master 的解析视图：

- `variantOverrides`：岗位专属标量/内容字段；
- `variantOrdering`：按项目/经历稳定记录 ID 保存顺序；
- `variantPresentation`：技能高亮和作品链接选择；
- `variantTextOverrides`：按 `collection + recordId + field` 保存短描述，避免 master 插入或重排后串到其它记录；
- 未 override 的事实持续继承 master 最新值；
- 管理页侧栏、popup 和填表引擎读取岗位版本时都解析为最新继承视图。

简历文件导入发生在岗位版本激活状态时，姓名、联系方式、教育/经历等事实默认合并到 parent master，岗位专属 sidecar 不被导入静默覆盖。

### 2.3 字段级导入审核

导入编排是 `local parser → trusted merge → optional AI candidates → local policy → user review`。

审核 UI 提供：

- 当前档案 / 本地解析 / AI 建议 / 最终将写入 / 原文证据 / 操作；
- 默认“待审核”，可切“仅冲突 / 全部”；
- Critical/高风险字段单独突出；
- 冲突原因区分：锁定、已确认值不同、来源冲突、低置信、无证据、非法结构；
- “保留当前 / 保留并锁定 / 采用候选 / 采用并锁定”；
- 最终值可人工编辑，编辑后标记为人工确认；
- 所有未解决冲突清零前不能确认导入。

AI-only 图片/扫描导入从空 trusted seed 开始，不允许把 AI 自己的输出先当“当前可信值”绕过 evidence/confidence gate。

### 2.4 六态决策与风险预览

统一决策：

- `FILL_HIGH_CONFIDENCE`
- `FILL_REVIEW_REQUIRED`
- `OPTIONAL_UNMATCHED`
- `NEEDS_USER`
- `SKIP`
- `BLOCKED`

风险层级：`CRITICAL / HIGH / MEDIUM / LONG_TEXT / LOW`。

填写预览支持：

- 高置信与“必须重点核对”分区；
- AI 来源、语义 key、confidence、risk、reason 可见；
- 本次临时改值：只修改当前 FillPlan，不回写主档案；
- 取消本项：把当前项改为 `SKIP`；
- 保存个人规则：只有本地字段存在稳定 selector 且有合法 semanticKey 才写入 ruleStorage；
- 跨域子页面没有父页面 DOM 句柄时保持只读，不能伪装成已编辑或已保存规则；
- 整体确认后才执行；仍不自动提交/下一步。

### 2.5 严格读回验证

写入后必须由 typed verifier 读回。

- 只有 `VERIFIED` 计成功；
- 电话、邮箱、证件、日期/日期范围、布尔、数字、地区、URL、枚举/选择器等按类型归一化；
- 没有通用“substring contains 即成功”的最终兜底；
- `PARTIALLY_VERIFIED / MISMATCH / UNREADABLE / NOT_HANDLED` 不冒充成功；
- executor 保存 actualValue、verificationStatus、失败码和策略尝试链。

### 2.6 附件可信上传

- Resume/CV 目标与头像/照片/作品附件区分；
- 多个/模糊目标不自动选；
- 事件派发不等于成功；
- 通过 `input.files`、文件名展示和 upload-complete 状态读回；
- 未验证附件进入 `attachment_unverified`，不会伪装为已完成。

### 2.7 Personal Site Learning / Compatibility

个人映射状态：`ACTIVE / STALE / DISABLED`。

- selector/fingerprint 冲突自动 `STALE`；
- 实际严格验证结果回写 success/failure 健康度；
- 兼容矩阵：`UNSEEN / DETECTED / PARTIAL / PERSONAL_VERIFIED / DEGRADED`；
- 自动测试最多只能推进到 `PARTIAL`；
- `PERSONAL_VERIFIED` 必须由用户在真实个人网申页完成后显式记录；失败后可降级为 `DEGRADED`。

### 2.8 Scoped QA Bank

作用域优先级：

`job-posting > company-domain > job-family > global`

- 同一题可保存多个用户确认版本；
- 版本支持 `maxChars`；
- 运行时按当前 hostname、岗位版本 context 和字段 maxlength 选择最匹配版本；
- AI 草稿只有用户采用/确认后才允许进入 QA bank。

### 2.9 本地质量与诊断

- Fill history 不保存实际填写值；
- URL/错误/敏感字段脱敏；
- 标准失败码：mapping、adapter、write、verification、attachment、page/resume change、safety、AI timeout/invalid 等；
- 保存验证成功数、重点核对、可选未匹配、阻断、AI mapping 数和尝试策略；
- 历史页展示本地质量指标和站点兼容矩阵；
- 支持脱敏诊断导出和确定性离线 replay。

## 3. P1 实现映射

### 3.1 AI 简历解析 v2

模型目标输出：

```json
{
  "candidates": [
    {
      "path": "educations.0.major",
      "value": "软件工程",
      "confidence": 0.94,
      "evidence": { "page": 1, "quote": "软件工程 本科" }
    }
  ],
  "warnings": []
}
```

本地 gate：

- 精确字段路径白名单；
- 禁止系统/meta/variant 路径和 prototype-pollution 路径；
- 按 schema 检查 string / number / boolean 类型；
- 保留模型原始 confidence/evidence；
- text-only 文档的无页 quote 必须能在本地提取文本中找到；
- AI 候选与已锁定/已确认事实冲突时不自动覆盖；
- AI 候选无证据或 confidence < 0.70 时必须进入人工冲突审核；
- 同值 AI 佐证不会把 `manual + confirmed + locked` 元数据降级成 `ai-parser`。

旧“整份 resume JSON”只保留本地模型兼容读取，不再是新 prompt 的目标协议。

### 3.2 AI 字段映射 v2

输入只包含：

- label / placeholder / name / aria-label / 控件类型 / required；
- section / index / nearby labels / page title / site profile / option summary；
- resume key / 中文名称 / 值类型 / **hasValue boolean** / risk。

不发送实际档案值。

输出包含 confidence、reasonCode、alternatives；本地再次做字段/路径白名单、他人身份字段排除和风险阈值处理。AI 只能丰富 FillPlan，不直接写 DOM。

### 3.3 开放题 AI

- 待办中的文本开放题才提供 AI 草稿；
- 每次请求前用户确认发送岗位上下文和选定非敏感档案事实；
- background 只返回 draft；
- 本地校验 allowed resume keys、字数限制、公司名泄漏等；
- 用户可编辑并采用；
- 用户再次确认后才保存为 scoped QA answer version。

### 3.4 AI 岗位版本建议

只允许：

- 项目/经历排序；
- 已有技能高亮；
- 现有描述/自评裁剪；
- 已有作品链接选择。

本地验证：

- evidenceResumeKeys 必须真实存在；
- 排序必须是现有记录 ID 的完整排列；
- 技能只能来自现有技能；
- 链接只能来自现有 profile link；
- 文案只能写允许的内容字段；
- 用户逐条“采用”后才写 job variant sidecar；master 不被 AI 直接改写。

### 3.5 提交前一致性检查

执行后生成 deterministic blocker/warning：

- 姓名/电话/邮箱/证件等关键事实不一致；
- 当前工作/结束日期冲突、日期逆序；
- 非当前公司名泄漏；
- 未严格验证字段；
- 附件未验证。

OpenJobFill 只显示问题，不点击提交或下一步。

### 3.6 最小站点权限

安装时不再申请 `https://*/*` 或 `<all_urls>` 永久权限。

- 内置招聘/ATS origin：仅这些站点运行轻量 detector；
- 自定义招聘域名：用户点击“授权并添加”后，通过 optional host permission 仅授予该 origin；移除域名时尝试撤销；
- 其它陌生站点：默认不扫描，用户点击 popup 或快捷键后利用 `activeTab + scripting` 临时注入 runtime；
- AI Base URL：保存/测试连接时才请求该接口 origin 的 optional permission；
- 重型 Vue/解析/填表 runtime 仍按需注入。

## 4. 自动化开发验收

GitHub Actions 门禁包括：

1. TypeScript/Vue compile；
2. Vitest 单元测试和语义/反误匹配 benchmark；
3. production extension build；
4. Playwright Chromium；
5. 构建后的真实扩展 smoke：Shadow UI、持久化、MAIN-world 受限 adapter、风险预览后确认填写、严格读回、离线 replay、clipboard focus。

新增回归覆盖包括：

- strict verification false-positive；
- prototype-pollution 路径；
- locked/confirmed import；
- AI-only evidence/confidence gate；
- stable-ID job variant ordering/text sidecar；
- activeTab message protocol；
- required host permission 不允许全站 wildcard；
- custom domain/AI origin permission pattern；
- `PERSONAL_VERIFIED` 不可由 fixture 自动产生。

## 5. 真实站点验收：仍必须由本人完成

PRD 的 Definition of Done 要求至少 3 个本人经常使用的真实站点达到 `PERSONAL_VERIFIED`。这部分不能由代码仓库、匿名浏览、静态 fixture 或 CI 代替。

建议按以下 checklist 在本人登录态招聘申请页完成：

1. 打开本人真实、允许测试的职位申请页；
2. 确认扩展识别到当前页，但没有提交/下一步动作；
3. 查看风险预览，重点检查姓名、手机号、邮箱、证件、日期、薪资等；
4. 逐项取消或临时改值，确认只有预览计划变化；
5. 点击整体确认填写；
6. 对每个已填字段检查页面实际值与严格读回状态；
7. 对文件上传检查页面真实文件名/完成状态；
8. 人工处理剩余必填项；
9. **不要让 OpenJobFill 提交**，由本人决定是否手动提交；
10. 回到兼容矩阵，只有本人确认该模块在真实页成功后才能记录 `PERSONAL_VERIFIED`；
11. 对至少 3 个本人常用站点重复以上流程；
12. 若后续站点 DOM 更新导致失败，应降级 `DEGRADED` 并修复/重学映射。

在上述真实登录态验收完成前，本 PR 应保持 Draft，不能把“开发侧完成”表述成“PRD DoD 全部完成”。
