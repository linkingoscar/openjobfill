# 字段中心、目录数据与确定性回放维护

## 字段元数据

入口：`src/core/schema/resumeFieldRegistry.ts`。新增业务字段时同时更新标准简历类型、字段注册表及实际编辑/解析入口。不要仅往 TypeScript 接口添加属性就默认向 AI 暴露。

- `normalizeResumeFieldPath` / `getResumeFieldDefinition`：索引字段定位。
- `enumerateResumeFields`：本地枚举有值字段，保留零和明确的否定回答。
- `buildResumeClipboardItems`：按统一标签和分组展示。
- `buildResumeKeyOptions`：只投影标签与路径；不发送值，不绕过域名问答限制。
- `scrubSensitiveData`：根据注册表的诊断导出策略处理完整或嵌套简历，并保留自由文本 PII 清洗。

现有标准简历迁移/校验仍由 `resumeSchema.ts` 负责；元数据中心没有替代版本迁移器。

## 重建目录

数据是随代码审查的固定版本，不在扩展运行时更新。源数据包仅用于维护，不加入运行依赖。

1. 下载并解包 `china-division@2.7.0`。
2. 执行 `node scripts/generate-reference-data.mjs <解包后的 package 目录>`。
3. 安装维护用 Python 库 `pdfplumber`，执行 `python scripts/extract-major-catalog.py <教育部2026本科目录PDF>`。不传文件时脚本尝试下载教育部附件，失败后使用已注明的公开转载附件。
4. 对照原始 PDF 检查专业代码、学科归属和页面换行；脚本必须通过 13/92/883 完整性检查。特别注意外语类七位代码、交叉学科无专业类的情况。
5. 跑 `pnpm exec vitest run test/unit/referenceCatalogs.test.ts`；更新 NOTICE 与 README 中的版本、节点口径及覆盖边界。

地区的“中间层级节点”包含地级城市、直辖县级单位和地址分组，不能宣传成全国法定地级市数量。地区版本与本科专业版本独立；本科专业目录不覆盖专科、职业本科或研究生学科目录。

## 运行回放

入口：`src/core/pipeline/deterministicReplay.ts`。

```ts
const imported = await SnapshotRecorder.importProblemPackage(problemPackageJSON);
const report = await replayRunSnapshot(imported.sessions[0]);
// report.differences: sequence + stage + reason
```

生产 `PipelineExecutor` 接收受限 `ExecutionEnvironment`，区块工作流接收 `SectionWorkflowEnvironment`。默认环境仍操作真实控件；离线环境创建断开的占位元素，恢复录制的安全判断、策略列表、处理状态和等价判断，关闭装饰、计时等待及真实 DOM 写入。实际重试循环和区块流程运行的是同一份生产代码。

`createRecordedAIProvider(session)` 提供 `map(fields, options)` 与 `remaining()`，按顺序校验请求契约并返回录制映射。它不重新调用模型；默认运行回放验证 AI 事件配对并恢复传输响应，不声称重新评测模型语义质量或用脱敏简历重算所有规划决策。原有 `replaySnapshot(session, planner)` 仍可用于单独的规划回归。

正常排障先导出 v3 包。若记录被截断、缺少执行终态、上下文已失效或导入旧版包，报告会说明不能获得完整运行结论。要检查真实控件渲染或跨域 iframe 行为，继续使用浏览器联调；回放不会访问招聘网站或绕过其登录。

验证命令：

```sh
pnpm compile
pnpm test
pnpm build
pnpm test:e2e
```

端到端冒烟测试使用实际加载的 Chromium 扩展，覆盖网页焦点跨 Shadow DOM 搜索后点填、真实 MAIN-world 驱动、历史面板回放与回放不改写网页。

干净检出时 `pnpm install` 的 `postinstall` 会先运行 `wxt prepare`，生成 `.wxt/types`；若显式禁用了安装脚本，需要手动运行 `pnpm exec wxt prepare` 后再做类型检查。
