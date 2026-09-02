# Openjobfill_Plugin 合并清单

源目录：`D:\植物大战僵尸\opencode\repo\chaole\Openjobfill_Plugin`

目标目录：`D:\植物大战僵尸\opencode\repo\openjobfill`

本次采用“能力迁移”而不是覆盖式复制：目标项目是 WXT + Vue 3，旧项目是 Vite 扩展壳。相同能力接入目标项目已有管道；更弱的重复实现由现有模块承接，避免同时保留两套填表引擎。

## 运行时代码逐项对应

| 旧文件 | 目标实现 | 状态 |
| --- | --- | --- |
| `src/background/index.ts` | `src/entrypoints/background.ts` | 现有后台消息总线承接 |
| `src/content/domWatcher.ts` | `src/entrypoints/content-runtime.ts` | 现有 SPA/步骤监听承接 |
| `src/content/highlighter.ts` | `src/core/engine/badgeDecorator.ts` | 现有预览高亮承接 |
| `src/content/index.ts` | `src/entrypoints/content-runtime.ts` | WXT 入口承接 |
| `src/content/sidebarInjector.ts` | `src/components/FloatBall.vue` | Shadow UI 浮球承接 |
| `src/engine/adapters/antDesign.ts` | `selector.ts`、`dateEngine.ts` | 现有实现更完整 |
| `src/engine/adapters/atsPlatforms.ts` | `enhancers.ts`、`pageAnalyzer.ts`、`selector.ts` | 已补 MTD、LayUI、iView、51job/银行弹层选择器 |
| `src/engine/adapters/elementUI.ts` | `selector.ts`、`dateEngine.ts` | 现有实现更完整 |
| `src/engine/adapters/nativeAdapters.ts` | `retryLadder.ts`、`dispatcher.ts` | 现有实现更完整 |
| `src/engine/adapters/pairedDateAdapter.ts` | `dateEngine.ts` | 现有成对日期引擎承接 |
| `src/engine/adapters/registry.ts` | `src/core/adapters/index.ts` | 现有注册表承接 |
| `src/engine/adapters/types.ts` | `src/types/adapter.ts`、`pipeline.ts` | 现有类型承接 |
| `src/engine/aiService.ts` | `llmProvider.ts`、`fieldMapper.ts`、`providerPresets.ts` | 已补服务商预设、有限重试、地址归一化、OpenRouter 头 |
| `src/engine/attachmentUploader.ts` | `src/core/engine/attachmentUploader.ts` | 已迁移并接入浮球“附件”按钮 |
| `src/engine/autoFiller.ts` | `filler.ts` + `src/core/pipeline/*` | 两阶段预览管道承接 |
| `src/engine/cardStateMachine.ts` | `sectionEngine.ts`、预览确认流程 | 不照搬自动点“保存/下一步”，避免未经确认推进或提交表单 |
| `src/engine/dataDeriver.ts` | `src/core/derivation/profileDeriver.ts` | 已迁移；未回答意愿题不再默认“是” |
| `src/engine/domPruner.ts` | `snapshotRecorder.ts` | 脱敏字段骨架替代原始 DOM 快照 |
| `src/engine/dynamicBalancer.ts` | `sectionEngine.ts`、`repeater.ts` | 现有多经历差量加行承接 |
| `src/engine/expansionHelper.ts` | `src/core/engine/expansionHelper.ts` | 已迁移并限制危险按钮文案 |
| `src/engine/familyRelationsFiller.ts` | `sectionEngine.ts`、`pageAnalyzer.ts`、语义字典 | 统一规划器承接多行家庭关系填写 |
| `src/engine/fieldMatcher.ts` | `src/core/matcher/*`、`planGenerator.ts` | 现有置信度规划器承接 |
| `src/engine/flashFiller.ts` | `src/core/engine/manualFill.ts` | 现有手动点选填充承接 |
| `src/engine/heuristicMatcher.ts` | `heuristic.ts`、`similarityEngine.ts` | 现有实现更完整 |
| `src/engine/humanInput.ts` | `dispatcher.ts`、`retryLadder.ts` | 保留原生 setter + 完整事件链；不引入规避风控的随机轨迹和逐字延迟 |
| `src/engine/importers/index.ts` | JSON/文本统一导入入口 | 现有入口承接 |
| `src/engine/importers/jsonResumeImporter.ts` | `src/core/importers/jsonResumeImporter.ts` | 已迁移并支持 JSON Resume 标准 |
| `src/engine/importers/markdownImporter.ts` | `src/core/parser/resumeParser.ts` | 现有 Markdown/Word 解析更完整 |
| `src/engine/importers/platformSync.ts` | `platformProfileImporter.ts`、`FloatBall.vue` | 已迁移；显式点击确认后合并当前可见资料 |
| `src/engine/importers/types.ts` | `src/types/resume.ts` | 统一类型承接 |
| `src/engine/importers/visionImporter.ts` | `visionResumeImporter.ts`、`resumeImagePreparation.ts`、PDF 页面渲染、后台多模态 API | 已迁移；PDF 文本+页面图、Word 提取文本、独立图片页签、逐次确认、结果合并预览 |
| `src/engine/jobTracker.ts` | `trackerStorage.ts`、`pageJobExtractor.ts` | 已补页面岗位信息提取 |
| `src/engine/privacyScrubber.ts` | `src/core/privacy/privacyScrubber.ts` | 已迁移并改为递归脱敏 |
| `src/engine/snapshotReplay.ts` | `snapshotRecorder.ts` | 已迁移录制、脱敏导出与离线回放 |
| `src/options/App.vue` | `src/entrypoints/options/*` | 现有模块化设置页承接；新增意愿矩阵和 AI 预设 |
| `src/options/main.ts` | WXT options 入口 | 现有入口承接 |
| `src/popup/App.vue` | `src/entrypoints/popup/*` | 现有弹窗承接 |
| `src/popup/main.ts` | WXT popup 入口 | 现有入口承接 |
| `src/sidebar/sidebar.css` | `src/assets/main.css`、组件样式 | Tailwind/Shadow UI 样式承接 |
| `src/sidebar/SidebarApp.vue` | `FloatBall.vue` 与抽屉子组件 | 现有模块化浮球承接 |
| `src/types/messages.ts` | `src/types/message.ts`、`frames.ts` | 现有消息契约承接 |
| `src/types/resume.ts` | `src/types/resume.ts` | 已补驾照、意愿矩阵、处罚/亲属、紧急联系人字段 |
| `src/utils/normalizer.ts` | `src/core/resolvers/profileNormalizer.ts` | 已迁移省市、专业三级树、学历枚举 |
| `src/utils/storage.ts` | `src/core/storage/*`、`providerPresets.ts` | 现有分层存储承接并补 AI 预设 |
| `src/vite-env.d.ts` | WXT 自动类型 | 构建体系替代 |

## 没有复制的工程产物

旧项目的 `node_modules`、`dist`、缓存、旧 Vite 配置、旧 `package-lock.json` 和重复入口没有复制。它们不是产品能力，直接覆盖会破坏目标项目的 pnpm/WXT 构建和当前扩展清单。

## 安全边界

- 所有实际填写仍然先生成预览，用户确认后才写入。
- 不自动点击提交、下一步或不可逆保存按钮。
- 平台简历同步只读取当前页面可见 DOM，且点击确认后才写入本地简历。
- AI 字段映射仍只发送字段标签；视觉识别仅在用户选择图片并逐次确认后发送完整图片。
- 诊断快照不记录目标值，并在导出前再次递归脱敏。
