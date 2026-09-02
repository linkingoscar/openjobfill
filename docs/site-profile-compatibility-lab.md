# 站点画像与兼容性实验室

OpenJobFill 将“控件行为”和“招聘站点流程”分开维护：58 个 `ControlAdapter` 负责下拉、日期、级联和富文本等控件行为；版本化 `SiteProfile` 负责域名、路径、SaaS 模板、字段映射与重复卡片工作流。

## 运行时选择链

```text
精确 hostname/path SiteProfile
  → 共享 SaaS DOM 模板
  → SiteProfile 关联的 PlatformEnhancer
  → 通用 PlatformEnhancer
  → 通用字段规划器
```

所有画像都是打包进扩展的声明式数据。画像不能包含 JavaScript、任意事件名、网络地址、提交或下一步动作。重复区块只允许通过精确可见文案执行“编辑、保存、新增”，`type=submit` 按钮即使显示“保存”也会被拒绝。

## 内置画像

当前目录包含 27 个画像，覆盖腾讯、阿里、字节、京东、网易、美团、滴滴、B 站、小米、叠纸、快手、百度、小红书、华为、米哈游、新凯来、PICC、拼多多、美的、智联校园、Fandow、51Job、国聘、比亚迪、招商银行、NHRDC 和智联招聘。

画像的权威清单和验证等级位于 `src/core/adapters/siteProfiles.ts`；测试引用必须登记在 `src/core/adapters/compatibilityLab.ts`。重复域名、未知 Fixture、不安全动作、超过 20 条的自动流程以及没有验证日期的 `SITE_VERIFIED` 都会使目录审计失败。

## 受控重复区块流程

```text
FIND_SECTION
  → ENTER_EDIT
  → FILL_RECORD
  → SAVE_RECORD（精确文案 + 非 submit + DOM 状态验证）
  → ADD_RECORD（精确文案 + 新卡片/编辑器验证）
  → WAIT_FOR_EDITOR
  → 下一条 / COMPLETE
```

- 分析阶段只产生 `SectionPreparationPlan`，不点击页面。
- 悬浮面板会在预览中列出重复区块动作。
- 用户确认后，普通多卡页面先差量扩容再重新扫描；Save-before-next/单卡页面逐条重新扫描、填充、回读并推进状态机。
- 任一必填字段未完成、保存状态无法确认或新增后未出现编辑器，流程立即停止并进入人工待办。
- 永远不点击“提交申请”“下一步”“继续”等动作。

## 支持状态口径

| 状态 | 含义 |
| --- | --- |
| `REGISTERED` | 数据已登记，尚未证明路由可达 |
| `ROUTE_VERIFIED` | hostname/path/DOM 证据能路由到画像 |
| `FIXTURE_VERIFIED` | 脱敏代表性 DOM 已验证规划、动作和回读 |
| `SITE_VERIFIED` | 在站点当前线上版本完成人工验证，并记录日期 |

本地测试不得被描述为线上完全兼容。站点改版后，应先保存不含简历值的失败 Fixture，再修改画像或 Adapter；通过 Fixture 后仍需在真实站点验证，才能升级为 `SITE_VERIFIED`。

## 自动化门禁

- `siteProfiles.test.ts`：画像 Schema、域名/path 路由、模板检测、危险动作拒绝。
- `sectionWorkflow.test.ts`：Save-before-next/单卡状态机与 submit 拒绝。
- `pipeline.test.ts`：预览零 DOM 写入，以及确认后的画像工作流集成。
- `controlAdapters.test.ts` / `controlAdapterRouting.test.ts`：58 个控件适配器行为与路由。
- `trackerStorage.test.ts` / `pageJobExtractor.test.ts`：投递数据迁移、幂等、草稿恢复和 JSON-LD。
