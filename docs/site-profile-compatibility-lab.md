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

当前目录包含 27 个画像。其中 OfferLink 明确登记的 27 个域名由 23 个画像承载（腾讯 2 域名、阿里 4 域名，其余逐站）；另有比亚迪、招商银行、NHRDC 和智联招聘 4 个补充画像。这里的“27 域名”和“27 画像”是两个不同口径，兼容审计会分别检查，避免用补充画像替代未覆盖站点。

画像的权威清单、结构证据和验证等级位于 `src/core/adapters/siteProfiles.ts`；27 份脱敏站点 Fixture 位于 `test/fixtures/offerlinkSiteProfiles.ts`，测试引用必须登记在 `src/core/adapters/compatibilityLab.ts`。重复域名、缺失/重复 Fixture、不安全动作、超过 20 条的自动流程以及没有验证日期的 `SITE_VERIFIED` 都会使目录审计失败。

画像中的结构证据会实际参与运行时：站点匹配后，`PageAnalyzer` 优先扫描已知表单根节点，并把画像声明的非原生下拉、级联、日期和单选控件加入候选。页面同时存在登录、搜索和申请表单时，这能减少扫错区域；若画像选择器因改版失效，则回退到通用表单扫描，不会阻断基础能力。

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
| `FIXTURE_VERIFIED` | 脱敏代表性 DOM 已验证站点路由、约束扫描和规划；写入回读与区块动作由关联的控件/工作流 Fixture 验证 |
| `SITE_VERIFIED` | 在站点当前线上版本完成人工验证，并记录日期 |

本地测试不得被描述为线上完全兼容。站点改版后，应先保存不含简历值的失败 Fixture，再修改画像或 Adapter；通过 Fixture 后仍需在真实站点验证，才能升级为 `SITE_VERIFIED`。

## 2026-09-02 公开入口抽查

本轮使用真实 Chromium 做只读抽查，没有登录、填写或提交。腾讯、阿里、字节、京东、美团、拼多多、智联校园、51Job、国聘和美的 10 个代表入口均能建立站点链路，但公开页面没有暴露申请简历表单：

| 入口 | 公开检查结果 |
| --- | --- |
| 腾讯 `join.qq.com` | 从首页进入岗位列表和岗位详情；“投递简历”跳转登录页 |
| 阿里 `talent.alibaba.com` | 招聘首页可达，未渲染申请表单 |
| 字节 `jobs.bytedance.com` | 招聘首页可达，未渲染申请表单 |
| 京东 `campus.jd.com` | 校招首页可达，未渲染申请表单 |
| 美团 `zhaopin.meituan.com` | 重定向到 `/web/home`，仅公开搜索控件 |
| 拼多多 `careers.pddglobalhr.com` | 重定向到 `/campus/`，未渲染申请表单 |
| 智联校园 `xiaoyuan.zhaopin.com` | 首页可达，仅公开搜索控件 |
| 51Job `xyz.51job.com` | 重定向到 `/business/#/login` |
| 国聘 `c.iguopin.com/apply/` | 重定向到 `www.iguopin.com/login` |
| 美的 `careers.midea.com` | 重定向到 `/schoolOut/home`，未渲染申请表单 |

因此本轮只把 OfferLink 的 27 个明确域名升级到 `FIXTURE_VERIFIED`，`SITE_VERIFIED` 仍为 0。真实站点升级必须在用户已登录且有合法测试申请的环境中，验证“识别 → 预览 → 确认填写 → 回读”，并且不得执行最终投递。

## 自动化门禁

- `siteProfiles.test.ts`：画像 Schema、27 域名 Fixture、表单根约束、专用控件类型、域名/path 路由、模板检测和危险动作拒绝。
- `sectionWorkflow.test.ts`：Save-before-next/单卡状态机与 submit 拒绝。
- `pipeline.test.ts`：预览零 DOM 写入，以及确认后的画像工作流集成。
- `controlAdapters.test.ts` / `controlAdapterRouting.test.ts`：58 个控件适配器行为与路由。
- `trackerStorage.test.ts` / `pageJobExtractor.test.ts`：投递数据迁移、幂等、草稿恢复和 JSON-LD。
