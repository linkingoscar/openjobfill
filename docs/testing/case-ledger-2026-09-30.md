# 全量测试逐项处置清单

基线 2f7b1cc；408 个 Vitest 展开用例全部列入。retain=保留；rewrite=加强或修正范围；delete=删除。每个文件的具体评判依据见其开头，源文件链接对应基线以便查被删用例。这是源代码/断言审查记录，不代表每例都经过变异测试。

## test/benchmark/negativeContext.test.ts

- T001：6 个负样本从无生产调用的旧启发式迁到真实 pageAnalyzer/planGenerator，逐样本有字段存在前提与禁止映射断言，不再包装成总体 0%误填率。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T001 | 在所有排斥上下文与负样本场景中，误填率 (False Positive Rate) 应严格为 0% | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/benchmark/negativeContext.test.ts#L72) |

## test/benchmark/semanticBenchmark.test.ts

- T002：38标签逐个精确 top-key，替换允许少量错误的汇总 F1（旧 recall 分母遗漏错误分类）。故意将 Applicant Name 映射手机号时旧通过、新失败。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T002 | 应在 38 个回归样本上达到 >= 95% 的综合召回率与 F1-Score | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/benchmark/semanticBenchmark.test.ts#L66) |

## test/unit/adapterKit.test.ts

- T003：删除无生产入口的 queryFirst/FillSession 11 例；保留 AI 使用的身份排斥函数与真实匹配结果。短词边界测试重写，旧例对故意移除边界仍通过，新例失败。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T003 | 宽泛选择器 [name*="name"] 必须跳过 username / nickname，命中本人姓名字段 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L21) |
| T004 | 紧急联系人 / 家属姓名等第三方控件必须被排除，绝不填入本人信息 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L33) |
| T005 | 明确指定 allowIdentityTerms 时，第三方字段可被正常定位（回填紧急联系人场景） | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L45) |
| T006 | 中文排斥词同样生效（紧急联系人 / 推荐人 / 家属） | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L57) |
| T007 | 选择器数组按置信度顺序生效，而非 DOM 文档顺序 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L68) |
| T008 | isIdentityExcluded 对账号类与亲属类属性均返回 true | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L80) |
| T009 | 页面找不到控件必须计入 failed，而不是被误记为 skipped | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L100) |
| T010 | 简历中该字段无值才计入 skipped | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L116) |
| T011 | 0 与 false 属于有效业务值，不得按空值跳过 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L127) |
| T012 | 统计恒等式成立：filled + skipped + failed 等于声明的字段总数 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L142) |
| T013 | 多段经历区块缺失时必须返回 null 并计 failed，严禁降级到 document | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L158) |
| T014 | 区块数量不足时，第 2 段必须中止而非覆写第 1 段 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L169) |
| T015 | 两条路径对同一文本必须给出完全一致的结果 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L201) |
| T016 | 小词典路径的短词边界检查与大词典 AC 路径行为一致 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/adapterKit.test.ts#L224) |

## test/unit/aiFallback.test.ts

- T017：保留实际 applyAIFallbackToPlan 路径、响应解析、候选过滤和隐私边界。transport mock 仅代替扩展消息，不代替计划生成或身份判定；prompt 文案检查只保证提示存在，不等同模型行为。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T017 | 解析纯 JSON 映射 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L76) |
| T018 | 解析 markdown 代码块包裹的映射 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L80) |
| T019 | 解析带前后文解释的映射 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L85) |
| T020 | 非法 JSON 返回空映射而非抛错 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L90) |
| T021 | prompt 必须包含字段清单与简历候选，且带第三方字段警示 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L96) |
| T022 | buildResumeKeyOptions 必须包含家属字段，以承接第三方联系人字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L107) |
| T023 | 排除按钮、隐藏域、密码框，保留文本与下拉 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L122) |
| T024 | 搜索框与验证码不应交给 AI | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L137) |
| T025 | AI 未启用时不改动 plan | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L199) |
| T026 | AI 映射成功的 NEEDS_USER 字段被就地提升为 FILL 并补 targetValue | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L211) |
| T027 | AI 调用失败时保留本地计划并告知继续操作方式 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L229) |
| T028 | AI cannot override label-only person identity or split-date manual work | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L240) |
| T029 | AI 把紧急联系人映射到本人姓名时被安全拦截，保持 NEEDS_USER | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L255) |
| T030 | AI 映射到家属字段时正常提升 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L267) |
| T031 | 简历对应字段为空时保持 NEEDS_USER，不硬提升 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/aiFallback.test.ts#L280) |

## test/unit/applicationArchive.test.ts

- T032：Per-URL draft persistence and targeted clearing distinguish query-only job identities. Real localStorage is exercised; no fake draft repository. The extractor mock is irrelevant to this storage-only case. Keep the exact surviving A job and absent B assertions.
- T033：Archiving B cannot reuse A draft or an old JD title. The salary isolation claim had no conflicting salary in the resume fixture, and no assertion observed reuse of A match score. Added a conflicting resume salary, checked B resume title and the unevaluated JD notice; kept A draft preservation.
- T034：Archiving an existing draft uses its saved resume title instead of the current resume. Checking only applications[0] allowed extra archived records and never proved draft cleanup. Require exactly one A record, original URL/company/resume title, and removal of the consumed A draft.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T032 | 同域不同查询岗位各自保留草稿，清除一个不影响另一个 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/applicationArchive.test.ts#L16) |
| T033 | A草稿在B页不出现，也不与旧JD标题或期望薪资混合 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/applicationArchive.test.ts#L23) |
| T034 | 回到A归档时使用A的岗位和投递时简历，不挪用当前简历 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/applicationArchive.test.ts#L34) |

## test/unit/backupManager.test.ts

- T035：An offline application with an empty URL survives backup import, and does not prevent importing another valid online job. Both merge and overwrite really execute different restore branches. Numeric URL rejection is checked through preview. Two runtime rows are not duplicates. Keep both mode rows. Missing-versus-empty URL and duplicate identity are separate untested cases.
- T037：Preview is read-only; overwrite stores a recovery point; restore recovers old resume, domains, and active selection. Preview checked only domains, so a preview mutation of resumes/rules/apps/active ID could pass. Snapshot every localStorage key/value around preview. Existing real overwrite/recovery checks remain. Does not simulate a process/browser restart.
- T038：Recovery-point quota failure prevents the first destructive resume replacement. Injected localStorage.setItem failure and real preceding export exercise the guard. The replace spy is a useful negative side-effect boundary. Keep. Chrome promise-based recovery-point failure remains uncovered.
- T039：Export serializes the seeded resume, custom mapping, domains, and application into a parseable versioned envelope. Nonempty lengths could pass by exporting defaults or unrelated dummy records. exportedAt merely being defined did not require a date. Assert known IDs and business fields, exact domain/app lists, actual mapping selector/key, and a parseable exportedAt. Preset rules are allowed alongside the seeded mapping.
- T040：Full backup import restores all four modules, and a legacy resume array changes only the resume module. Original title claimed legacy-array compatibility but the only input was a full object; the array/resumes-only branch was never reached. After real full import, import a pure array in overwrite mode and assert resume replacement plus byte-equivalent returned rules/domains/applications and zero non-resume import counts.
- T041：Overwrite removes old resumes/rules/domains and empties applications when incoming applications are empty. No old application was seeded; an implementation that never cleared applications would pass. Seed an old application and require an empty tracker afterward. Existing resume and domain removal checks remain.
- T042：Malformed custom-rule fields are rejected before an incoming resume replaces stored data. Title said any module although only customRules was corrupted. Existing assertions are meaningful for prevalidation order. Narrowed the title to the rule module; retain old-resume present and incoming-resume absent. No false claim of a validation matrix.
- T043：Backup import rejects a non-string nested education schoolName before writing that resume. Overlaps core schema validation intentionally at an independently exposed backup trust boundary. Empty starting state does not prove rollback. Keep as backup-entrypoint validation; do not count it as transaction/rollback coverage.
- T044：A failure in the final tracker write rolls back previously written modules and the selected resume. Only resumes/domains were checked, while title promised all modules. Spy call count 2 proved orchestration, not recovery of rules/apps. Spy was not restored on assertion failure. Seed and compare old rules and applications, assert active resume restoration, retain resume/domain assertions, and restore the spy in finally. Removed call-count proxy.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T035 | 无网址记录可原样恢复，当前空网址也不阻断其他备份：merge | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L14) |
| T036 | 无网址记录可原样恢复，当前空网址也不阻断其他备份：overwrite | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L14) |
| T037 | 预览不写入；覆盖后跨调用恢复旧数据和原激活简历 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L27) |
| T038 | 恢复点无法保存时不得开始覆盖 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L48) |
| T039 | exportFullBackup 应该生成包含所有存储模块数据的完整 JSON 备份 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L58) |
| T040 | importFullBackup 能够完整还原各模块数据并兼容旧版纯数组格式 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L105) |
| T041 | importFullBackup 支持 mode: overwrite 完全覆盖恢复当前数据 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L168) |
| T042 | 遇到任一模块格式错误时应在写入前拒绝，避免部分导入 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L233) |
| T043 | 简历嵌套字段类型错误时也应在写入前拒绝 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L258) |
| T044 | 覆盖恢复中途写入失败时应回滚所有已写入模块 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/backupManager.test.ts#L280) |

## test/unit/controlAdapterRouting.test.ts

- T045：58 种简化结构仅验证路由注册，9 种扫描结构验证无 input 容器识别；不证明站点填写成功。以注册 ID 集合覆盖代替固定数量断言。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T045 | 每个登记 Adapter 都应能被自身结构和站点证据实际路由 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapterRouting.test.ts#L95) |
| T046 | 没有内部 input 的站点控件也应被页面扫描并分配正确 Driver | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapterRouting.test.ts#L110) |

## test/unit/controlAdapters.test.ts

- T047：保留专属执行/回读、MAIN 授权消息与通用降级边界；搜索成功/不提交成对用例有效。诊断脱敏插入真实测试值；交通银行弹层改为确认后才提交状态。My97 仅消息协议，不证明日历实现。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T047 | 应完整、唯一登记生产兼容矩阵中的 58 个 Adapter | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L46) |
| T048 | Moka 搜索下拉应优先匹配站点专属 Adapter，并输出无值诊断轨迹 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L60) |
| T049 | 51Job 组合电话应拆分区号和本地号码，并通过专属回读验证 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L75) |
| T050 | 搜索下拉以提交状态验证成功，不能把检索词当选中值（提交=true） | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L104) |
| T051 | 搜索下拉以提交状态验证成功，不能把检索词当选中值（提交=false） | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L104) |
| T052 | MAIN world 桥只能通过一次性授权发送固定动作与结构定位器 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L130) |
| T053 | 51Job 静态候选的路由与路径读回契约（异步层级另测） | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L163) |
| T054 | 拉勾富文本应使用专属 Adapter 写入并回读 contenteditable | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L202) |
| T055 | TP-Link 民族选择器应从弹层选择并回读渲染值 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L222) |
| T056 | 交通银行弹层选择器应确认候选并走专属回读 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L249) |
| T057 | My97 消息桥接路由契约（模拟响应，不代表实际日历验收） | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L276) |
| T058 | 普通输入不应误命中复杂控件 Adapter，仍由通用策略兜底 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlAdapters.test.ts#L308) |

## test/unit/controlCompatibility.test.ts

- T059：删除被同文件完整 pipeline 覆盖的两个直接日期/Semi 选择正例。保留跨年日历、虚拟滚动、ARIA 状态、ShadowRoot、年月组合和日期范围的不同路径。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T059 | 应识别 Semi、ARIA 选择控件、日期弹层与年月组合 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L27) |
| T060 | 应扫描 open ShadowRoot 中的字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L43) |
| T061 | ARIA radio、checkbox 和分段按钮应按目标状态操作 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L53) |
| T062 | 受控日期直接写值失败后应点击弹层中的精确日期 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L71) |
| T063 | Ant 风格日期弹层应跨年份分页并选择目标年月日 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L85) |
| T064 | “至今”文字位于 label 时应读取内部 checkbox 的真实状态 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L138) |
| T065 | Semi Portal 下拉应能选择并读到目标项 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L149) |
| T066 | 虚拟下拉未命中首屏时应滚动并继续查找选项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L163) |
| T067 | 平台专属 addButton 应优先用于增补教育经历 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L183) |
| T068 | 复杂日期、Semi 下拉和年月组合应通过完整 Pipeline 写回验证 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L205) |
| T069 | 日期范围字段应把同一段经历的开始和结束日期成对写入 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/controlCompatibility.test.ts#L235) |

## test/unit/crossSystemAudit.test.ts

- T070：各平台有不同宽泛选择器触发面；保留计划层禁止本人数据误填以及实体前缀拒绝。与 label-only 组分别覆盖属性证据和标签证据；不代表实时 ATS 兼容。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T070 | moka | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T071 | beisen | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T072 | dayee | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T073 | feishu | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T074 | beisen-school | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T075 | beisen-company | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L18) |
| T076 | generic no-enhancer should not misfill emergency contact | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L24) |
| T077 | native school select must not accept a different institution sharing its prefix | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/crossSystemAudit.test.ts#L28) |

## test/unit/customRuleMatcher.test.ts

- T078：保留重渲染 locator 恢复和选择器复用冲突，两例分别防漏填和错填；真实分析器/计划器参与。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T078 | CSS class 变化后应使用 locator 证据恢复映射 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/customRuleMatcher.test.ts#L13) |
| T079 | 选择器被复用到另一字段且与指纹冲突时应标记 STALE 并拒绝套用 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/customRuleMatcher.test.ts#L36) |

## test/unit/deterministicReplay.test.ts

- T080：保留真实执行器重放、篡改计数/缺事件、AI 请求漂移和旧版本拒绝。策略 mock 为记录外部 I/O，执行/比较代码是真实生产实现。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T080 | reexecutes production retry/verification logic with no live page writes or provider calls | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/deterministicReplay.test.ts#L26) |
| T081 | detects changed result counts, missing events and incomplete execution | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/deterministicReplay.test.ts#L36) |
| T082 | supplies recorded AI mappings only for an identical request and rejects request drift | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/deterministicReplay.test.ts#L45) |
| T083 | imports legacy plans without claiming they are full runtime recordings | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/deterministicReplay.test.ts#L56) |

## test/unit/dispatcher.test.ts

- T084：保留输入/textarea/radio/checkbox/点击事件基本契约；事件链改为严格顺序，标记生命周期补到期检查。React tracker shim 仅内部兼容契约，明确不声称 React 集成通过。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T084 | 应该能穿透设置 HTMLInputElement 的值并派发完整事件链 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L16) |
| T085 | 应该能穿透设置 HTMLTextAreaElement 的值 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L37) |
| T086 | 针对 React 的 _valueTracker 应该能正确重置以触发 React 受控状态更新 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L47) |
| T087 | setNativeRadioChecked 应能正确设置单选框 checked 状态并触发 change 事件 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L66) |
| T088 | setNativeCheckboxChecked 应能正确设置复选框 checked 状态 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L85) |
| T089 | simulateClick 应派发完整的 mousedown/mouseup/click 序列 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L102) |
| T090 | markElementAsAutofilled 与 isAutofillTouched 应具备跨 frame DOM 属性标记与短时生命周期 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/dispatcher.test.ts#L116) |

## test/unit/fillHistoryStorage.test.ts

- T091：Stored diagnostic projections omit actual fill values and sanitize URL query/hash, dynamic IDs, email/phone/name in verification messages. Only first field was checked for absence of value; selective negative assertions could overlook leaks in another field or wrapper. No positive oracle for retained diagnostic structure. Require exact safe field projections/messages and scan the entire serialized record for all fixture secrets, while preserving labels, status and reason.
- T092：Newest-first history retains the last 30 append operations and evicts the oldest three. Loop size and expected length both imported the production cap; changing 30 to 300 would still pass despite the named product contract. Use independent literal 33 inputs and exact 30 expected ordered page titles. Real append/read storage path remains covered.
- T093：Export preserves stored record contents and clear empties history. One exported row could be fabricated or corrupted while product and count assertions still passed. Compare full JSON-compatible exported record to the created record, then verify clear through getRecords.
- T094：Analysis failures create sanitized error records while retaining useful diagnostic context. The old fixture leaked the same name outside the labeled actual-value clause. Tests checked only email and the labeled substring, so the real leak passed. Added exact sanitized operationError plus whole-record name exclusion. It failed before the bounded sanitizer change and passes after. Exact context text preservation is asserted. See privacy evidence below.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T091 | 只保存诊断字段并移除 URL 查询参数和简历实际值 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillHistoryStorage.test.ts#L40) |
| T092 | 最新记录置顶且最多保留 30 次 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillHistoryStorage.test.ts#L56) |
| T093 | 可以导出和清空历史记录 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillHistoryStorage.test.ts#L71) |
| T094 | 页面分析或执行崩溃时也能生成脱敏诊断记录 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillHistoryStorage.test.ts#L86) |

## test/unit/fillReliability.test.ts

- T095：保留跨平台 label-only 身份门禁、合法联系人正例、运行时标签变化、完整 typed readback、实体歧义与必填分组日期。参数化每行有不同边界，不按重复标题删除。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T095 | routes https://app.mokahr.com/campus_apply/example/1 safely with label-only other-person evidence | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L21) |
| T096 | routes https://example.italent.cn/apply safely with label-only other-person evidence | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L21) |
| T097 | routes https://example.wintalent.cn/apply safely with label-only other-person evidence | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L21) |
| T098 | routes https://nio.jobs.feishu.cn/campus/apply safely with label-only other-person evidence | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L21) |
| T099 | auto-maps separately supplied emergency contact instead of candidate phone | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L33) |
| T100 | retains explicit emergency-contact data and manual menu choice | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L40) |
| T101 | does not blanket-ban ordinary candidate contact information | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L49) |
| T102 | keeps school and company mappings after narrowing Beisen name precedence | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L54) |
| T103 | blocks unsafe learned mappings and reevaluates live labels at execution | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L60) |
| T104 | allows separately supplied family mapping | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L70) |
| T105 | phone adapter cannot override verification with a suffix or non-phone text | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L77) |
| T106 | compares +86 139-0000-0001 against 13900000001 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T107 | compares 00000001 against 13900000001 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T108 | compares fictional+tag@example.com against fictional@example.com | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T109 | compares  Fictional@EXAMPLE.COM  against fictional@example.com | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T110 | compares 陈 against 陈小明 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T111 | compares A-B against AB | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T112 | compares 北京市 against 北京 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T113 | compares 广东省/深圳市/南山区 against 广东省-深圳市-南山区 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T114 | compares 广东省/深圳市/福田区 against 广东省-深圳市-南山区 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T115 | compares 大学本科 against 本科 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T116 | compares 本科及以上 against 本科 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T117 | compares 清华大学 against 清华 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T118 | compares 东南大学 against 东大 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T119 | compares 清华大学 against 清华大学（深圳校区） | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T120 | compares 测试大学独立学院 against 测试大学 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T121 | compares 不确定 against true | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L86) |
| T122 | chooses exact entity instead of earlier prefix match | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L106) |
| T123 | refuses ambiguous aliases and preserves campus qualifiers before selecting | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L112) |
| T124 | does not click a custom dropdown entity prefix | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L121) |
| T125 | does not inherit another field required marker or fill an unlabelled year | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L132) |
| T126 | exposes all missing required date parts as remaining work after execution | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillReliability.test.ts#L137) |

## test/unit/fillSession.test.ts

- T127：保留确认后执行、加载中取消、旧 frame 回调、切换简历、卸载和失败恢复六个异步状态边界；mock engine 是 composable 的外部依赖，断言的是会话状态和副作用。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T127 | only executes a confirmed preview, then owns the result and incremental preview | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L43) |
| T128 | cancels before resume loading finishes without starting an engine run | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L62) |
| T129 | does not let a late cross-frame response replace a newer preview | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L76) |
| T130 | releases local and remote plans on a resume switch and prevents old execution | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L93) |
| T131 | unmounting cancels execution and ignores its late result | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L105) |
| T132 | leaves the session usable after analysis fails | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/fillSession.test.ts#L119) |

## test/unit/floatingBallPosition.test.ts

- T133：五例分别验证拖动钳位、左右方向、窄屏宽度和低屏高度；精确像素是纯函数的布局约定，Chromium 另证实际可视布局。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T133 | 拖动后应始终把悬浮球限制在可视区域内 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/floatingBallPosition.test.ts#L10) |
| T134 | 右侧悬浮球的面板应向左展开并保持在屏幕内 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/floatingBallPosition.test.ts#L15) |
| T135 | 左侧悬浮球的面板应优先向右展开 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/floatingBallPosition.test.ts#L22) |
| T136 | 窄视口应同时为抽屉、间距和悬浮球预留空间 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/floatingBallPosition.test.ts#L28) |
| T137 | 视口较矮或悬浮球偏下时应收缩抽屉高度 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/floatingBallPosition.test.ts#L34) |

## test/unit/frameCoordinator.test.ts

- T138：保留跨源边界根节点和同源后代去重；输入和期望是明确 frame 树，未模拟浏览器跨域权限执行。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T138 | 只选择跨源边界根节点，同源后代交给父 frame 递归扫描 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/frameCoordinator.test.ts#L5) |

## test/unit/heuristic.test.ts

- T139：删除已无生产调用 matchElementToResumeField 的四个测试；保留当前 PlanGenerator 调用的文本评分三例。旧负样本改走当前生产计划器。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T139 | 完全相同或去标点后相同应为 1.0 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L11) |
| T140 | 前缀/后缀匹配应为 0.9 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L16) |
| T141 | 包含关系应为 0.75 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L21) |
| T142 | 应该能基于 label 关联精准识别基础字段 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L27) |
| T143 | 已填入内容的非空输入框应该被跳过 (避免覆盖已有内容) | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L45) |
| T144 | 多段经历卡片应能正确感知 Index 序号并映射为 educations.1.* 等 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L61) |
| T145 | 问答库 (Q&A Bank) 应该在 textarea 开放问题中享有最高优先级 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/heuristic.test.ts#L90) |

## test/unit/iframeAnalyzer.test.ts

- T146：保留单/双层同源 frame、控件类型、访问抛错容错、所属 Window select、徽标生命周期和必填标记隔离；happy-dom 不能替代实际跨域浏览器验证。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T146 | 应该能够穿透并提取同源 iframe 内部的表单控件 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L14) |
| T147 | 同源 iframe 内部的 textarea, select 和 radio group 应被准确识别且 options 正常提取 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L63) |
| T148 | 应该继续穿透第二层同源 iframe，而不是只扫描门户 iframe 第一层 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L108) |
| T149 | 面对跨域 iframe 访问受限抛出异常时，应具备容错弹性而不崩溃 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L133) |
| T150 | iframe 内原生 select 应使用所属 Window 的事件与类型判断 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L155) |
| T151 | iframe 内字段也应显示成功/待补徽标，并能被清理 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L175) |
| T152 | 同一表单行的必填星号不应泄漏到并排的非必填字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/iframeAnalyzer.test.ts#L204) |

## test/unit/jdMatcher.test.ts

- T153：保留未知/零命中/部分命中三个产品结果，精确分数和 matched/missing 列表能发现计算/措辞回归。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T153 | 没有可用关键词时不制造匹配分数 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/jdMatcher.test.ts#L7) |
| T154 | 零命中为0，部分命中按真实比例显示，不承诺初筛或录用 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/jdMatcher.test.ts#L13) |

## test/unit/jsonResumeImporter.test.ts

- T155：JSON Resume maps identity/location, normalized degree/dates, work and project/skill fields. Title claimed multiple experiences but fixtures contained one record per group; lengths and second-row preservation were never observed. Added a second education and completed job; assert both rows, current/completed status, highlights/summary and declared country/location.
- T156：Missing degree, country, work years and study format remain unknown instead of invented. Uses JSON Resume path, distinct from vision and text parsing despite shared downstream schema. Keep all importer entrypoint guards. Note untested skill-level/project-role defaults below.
- T157：Complete but unsupported JSON is rejected rather than silently parsed as resume text. Exercises importResumeText JSON-first error propagation, not merely JSON.parse. Keep. Truncated JSON fallback is a separate branch.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T155 | 映射标准 JSON Resume 的核心字段和多段经历 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/jsonResumeImporter.test.ts#L5) |
| T156 | JSON 未声明的学历、工龄、国家和学习形式保持未知 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/jsonResumeImporter.test.ts#L29) |
| T157 | 对看起来完整但格式不支持的 JSON 给出错误，不静默当纯文本 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/jsonResumeImporter.test.ts#L37) |

## test/unit/llmProvider.test.ts

- T158：保留 Ollama/OpenAI 请求格式、超时、重试、鉴权不重试、图片内联限制和 PDF/Word 分流。fetch mock 为网络边界，未证明远端模型服务兼容。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T158 | Ollama 请求应使用本地聊天接口并解析回复 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L9) |
| T159 | 请求被 Abort 时应快速返回可读的超时错误，避免填表无限等待 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L28) |
| T160 | 对限流与服务端故障有限重试，但不重复拼接完整接口路径 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L40) |
| T161 | 鉴权错误不可重试 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L57) |
| T162 | 云端视觉请求应使用 OpenAI 兼容的 image_url 消息 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L67) |
| T163 | Ollama 视觉请求应剥离 data URL 前缀 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L90) |
| T164 | PDF 补强应同时发送本地提取文本和多页页面图 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L106) |
| T165 | Word 补强没有页面图时保持普通文本消息以兼容文本模型 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L123) |
| T166 | 视觉请求拒绝外部图片 URL | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/llmProvider.test.ts#L139) |

## test/unit/mainWorldBehavior.test.ts

- T167：保留实际可序列化 MAIN driver 的取消、实体前缀拒绝、禁用项边界；geometry mock 只满足可见前提，真实 MAIN 注入另有 Chromium 流程。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T167 | honors cancellation before a MAIN-world text write | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mainWorldBehavior.test.ts#L5) |
| T168 | never substitutes a university college through substring matching | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mainWorldBehavior.test.ts#L9) |
| T169 | does not click a disabled exact match | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mainWorldBehavior.test.ts#L13) |

## test/unit/manualFill.test.ts

- T170：保留字段展开、空项、多记录、QA 和保存映射。原空简历测试含残留数据且可空循环通过，重写为 EMPTY_RESUME 的精确空数组。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T170 | 提取有值的基础字段并展开嵌套对象 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L45) |
| T171 | 跳过空值字段，不进入可选清单 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L56) |
| T172 | 多段经历带序号，且不遗漏 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L66) |
| T173 | 问答库进入可选清单 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L75) |
| T174 | 空简历返回空清单，调用方应提示并中止 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L84) |
| T175 | 用户明确点选目标和值后，记住当前站点映射供下次自动填写 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/manualFill.test.ts#L99) |

## test/unit/message.test.ts

- T176：保留所有列出的合法/非法消息分支，重要协议安全边界；既有接受也有拒绝，固定返回 true/false 都会失败。未覆盖所有可能载荷组合。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T176 | accepts bounded Tracker storage messages and rejects invalid statuses | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/message.test.ts#L5) |
| T177 | accepts the storage and cross-frame messages used by current callers | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/message.test.ts#L16) |
| T178 | rejects malformed or unknown payloads before they reach handlers | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/message.test.ts#L61) |

## test/unit/mokaRegression.test.ts

- T179：保留实际曾出现的结构分析缺陷：区块索引、标签/必填隔离、自有徽标污染、裸年月、不消耗重复专业、完整日期、高中、SD 提交和无结果重试。简化结构不冒充实时网站。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T179 | counts education cards within education rather than all sibling sections | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L21) |
| T180 | reads a label above nested inputs without inheriting a neighbouring required marker | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L38) |
| T181 | does not let its own success badge become the label on a second scan | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L47) |
| T182 | never infers a full birth date from a bare year or month label | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L56) |
| T183 | can reuse the highest education major in the education card after a basic summary field | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L64) |
| T184 | rejects partial dates and placeholders while accepting equivalent complete dates | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L75) |
| T185 | preserves high school education from the source document | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L82) |
| T186 | selects an SD search result through its option instead of only writing its input | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L86) |
| T187 | does not report success if SD search text has no selectable result | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/mokaRegression.test.ts#L112) |

## test/unit/pageFocus.test.ts

- T188：保留扩展 Shadow DOM 内聚焦、页面转移及 6 种失效目标；每个参数触发独立可写性分支。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T188 | retains the page destination through extension search and keyboard button focus | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L15) |
| T189 | forgets the destination when the user focuses another page control | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L22) |
| T190 | revalidates a removed destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |
| T191 | revalidates a disabled destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |
| T192 | revalidates a readonly destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |
| T193 | revalidates a password destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |
| T194 | revalidates a captcha destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |
| T195 | revalidates a hidden destination after a page update | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageFocus.test.ts#L27) |

## test/unit/pageJobExtractor.test.ts

- T196：保留 DOM/JSON-LD 优先级与申请成功正负判断；只测试明确页面结构，不证明所有招聘网站结构覆盖。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T196 | 优先读取语义明确的岗位、公司、薪资和 JD 节点 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageJobExtractor.test.ts#L5) |
| T197 | 识别明确的申请成功页，但不把普通岗位页误判为成功 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageJobExtractor.test.ts#L27) |
| T198 | 优先使用 JSON-LD JobPosting，并记录字段来源 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pageJobExtractor.test.ts#L35) |

## test/unit/pdfExtractor.test.ts

- T199：Same-Y text is sorted by X and separated correctly. Exact output with shuffled input directly catches missing horizontal sorting; not a snapshot of implementation internals. Keep. Near-touching CJK/Latin spacing and tolerance thresholds are separate branches.
- T200：Different-Y rows sort top-down while same-row phone/email remain correctly joined. Original middle-line contains checks allowed extra/duplicate text or incorrect separator. Assert exact three output lines.
- T201：A three-column table with full-width descriptions stays in single-column reading order. Chained index comparisons examined first row only; a missing first token yielded -1 and could still satisfy the chain. Assert all 20 expected output lines across 10 rows, so omission, duplication and reordering fail.
- T202：True two-column page emits every left entry before every right entry, in row order. Original only required three tokens to exist and the last left token before a later right work heading. Earlier right education entries could interleave and pass. Reverse raw item input and assert exact complete left-block/blank-line/right-block output.
- T203：Spanning header appears intact before complete ordered left/right columns. Original checked four selected indexes; lost body entries, duplicate headers and within-column reordering passed. Reverse raw input and require exact header/left/right blocks with every fixture token.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T199 | 同一水平线上的散落文本块，应按 X 坐标从左到右排序拼接 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pdfExtractor.test.ts#L6) |
| T200 | 不同 Y 轴高度的文本，应按从上到下 (Y 降序) 正确聚类成多行 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pdfExtractor.test.ts#L17) |
| T201 | 日期、单位、职位三列加通栏职责的单栏简历不应被误判为双栏 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pdfExtractor.test.ts#L37) |
| T202 | 对于左右双栏简历，必须先完整输出左栏内容，再输出右栏内容，绝不能左右穿插交叉 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pdfExtractor.test.ts#L62) |
| T203 | 双栏排版中跨越中轴线的通栏 Header (如姓名联系方式) 必须完整保留并优先置顶输出 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pdfExtractor.test.ts#L110) |

## test/unit/pipeline.test.ts

- T204：保留扫描/根范围/ShadowDOM、安全禁止字段、计划结果、验证器、取消/预览/过期/增量/保存流程。修正 input-only 标题；iframe readback 加顶层同名相反值，防原测试缺少干扰项。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T204 | 应该能正确扫描并解析各种表单控件的元数据与必填状态 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L77) |
| T205 | 应优先扫描申请表单根节点，排除同页搜索和登录表单 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L122) |
| T206 | 选择申请表单根节点后仍应扫描其内部宿主的开放 Shadow DOM | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L145) |
| T207 | 密码、验证码和支付字段必须在规划阶段被安全阻断 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L167) |
| T208 | 应该能正确识别高置信度字段、问答库并标记 NEEDS_USER 待办项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L190) |
| T209 | 应保留 false 问项并为专业级联生成完整路径 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L233) |
| T210 | 应该能准确读回 input 和 select 的值 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L254) |
| T211 | isSemanticEquivalent 支持明确行政区划、学历别名及完整日期等价 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L278) |
| T212 | radio 读回必须限定在本字段所属分组内，不得读回同页他处的选中项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L285) |
| T213 | 无 name 且无分组容器时，radio 读回不得退化为全文档查询 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L322) |
| T214 | iframe 内 radio 读回必须使用所属文档，不能串到顶层同名分组 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L350) |
| T215 | 执行规划后应成功完成写入、读回验证并输出 remainingTasks | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L384) |
| T216 | 收到 AbortSignal 后不得再写入任何字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L416) |
| T217 | 纯诊断模式不得扩展区块、调用填写或生成可执行计划 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L428) |
| T218 | 预览停留时间不应计入最终填写耗时 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L464) |
| T219 | 普通预览也不得提前展开、编辑或新增重复区块 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L483) |
| T220 | 确认后由站点画像状态机填写并验证单卡记录，再执行区块保存 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L502) |
| T221 | 表单节点被刷新后，不应继续执行旧预览计划 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L529) |
| T222 | SPA 步骤地址变化后，不应继续执行旧预览计划 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L546) |
| T223 | 增量规划只返回新增字段，不重复规划上一轮已处理字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/pipeline.test.ts#L561) |

## test/unit/platformEnhancers.test.ts

- T224：7 条 URL 是路由表契约；Greenhouse 原断言重复配置常量，改为实际扫描/计划产生 first/last/full 不同值。移除无意义硬编码 trace 长度。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T224 | URL https://apply.dayee.com/resume 应命中 dayee-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T225 | URL https://www.nowcoder.com/jobs/apply 应命中 nowcoder-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T226 | URL https://join.qq.com/apply.html 应命中 tencent-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T227 | URL https://talent.alibaba.com/campus/apply 应命中 alibaba-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T228 | URL https://zhaopin.meituan.com/apply 应命中 meituan-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T229 | URL https://boards.greenhouse.io/example/jobs/1 应命中 greenhouse-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T230 | URL https://jobs.lever.co/example/1 应命中 greenhouse-enhancer | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L18) |
| T231 | Greenhouse 的 first/last/full name 应映射到不同字段 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L30) |
| T232 | 普通 application-form 不应被误判为 Greenhouse，诊断应保留完整匹配轨迹 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformEnhancers.test.ts#L39) |

## test/unit/platformProfileImporter.test.ts

- T233：保留可见 DOM 导入、支持域路由和合并不变性。BOSS fixture 是约定 DOM 结构，不是当前真实账号页面验证。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T233 | 从 BOSS 个人简历可见 DOM 提取基本信息与经历 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformProfileImporter.test.ts#L6) |
| T234 | 仅在支持的平台显示同步入口 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformProfileImporter.test.ts#L18) |
| T235 | merging does not erase nonempty basics or duplicate existing experiences | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/platformProfileImporter.test.ts#L22) |

## test/unit/practicalAudit.test.ts

- T236：保留平台 SD 年月分组需要人工和截断输入不报成功；与直接等价函数测试不同，走分析到执行入口。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T236 | split education year/month surfaces required manual work | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/practicalAudit.test.ts#L12) |
| T237 | truncating controlled input must be failure not verified success | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/practicalAudit.test.ts#L17) |

## test/unit/precision.test.ts

- T238：保留未知/false/0、去重、radio 无匹配不修改、checkbox 模糊值、section 数量、隐含人口属性禁止、已有值保护与 cascader 路径。Section 私有计数断言仅组件回归，整合覆盖由 repeatedExperienceFill 提供。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T238 | hasUsableValue 必须正确判定有效值与无效假值 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L56) |
| T239 | 当简历字段为未知空串（如 gender = ""）时，绝不能生成 action: FILL 的规划项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L69) |
| T240 | 命中平台专属规则的字段，严禁再被问答库或通用语义生成第二个 PlanItem | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L104) |
| T241 | 面对同名性别单选框组，setRadioGroupValue 应能根据目标值准确定位并勾选目标单选框 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L145) |
| T242 | 当 targetValue 与组内所有 Radio 都不匹配时，必须返回 false 且绝不能修改任何 radio 状态 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L171) |
| T243 | parseBoolean 必须严格区分 true / false / null | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L195) |
| T244 | 遇到模糊词时，setNativeCheckboxChecked 必须返回 false，拒绝盲猜 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L210) |
| T245 | 即便子卡片内部不包含“教育”文字，SectionEngine 也能通过 Section Root 容器准确定位卡片数量 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L223) |
| T246 | 简历文本未明确提及性别、政治面貌、婚姻状况时，严禁默认推断出假值 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L245) |
| T247 | 当单选框组中已有 checked 的选项时，PlanGenerator 必须生成 action: SKIP 保护用户手动选择 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L263) |
| T248 | 当复选框已被用户勾选时，PlanGenerator 必须生成 action: SKIP 保护用户选择 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L293) |
| T249 | 当字段为 Cascader 时，PlanGenerator 应该输出完整的省-市-区路径 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/precision.test.ts#L320) |

## test/unit/privacyScrubber.test.ts

- T250：保留自由文本标点、递归 key/array、身份证/token 和输入不变性；精确替换内容有实际隐私意义。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T250 | 清洗自由文本且保留周围标点 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/privacyScrubber.test.ts#L5) |
| T251 | 递归清洗敏感键、数组与长文本 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/privacyScrubber.test.ts#L10) |

## test/unit/profileDeriver.test.ts

- T252：Work/project records combine in chronological order with mapped role/content/achievements and no input mutation. Original DEMO fixture assertions checked length and sorting only; placeholders or lost mapped details could pass. Replace DEMO with explicit three-record fixture; assert ID order, mapped business fields, unchanged work row and untouched source.
- T253：Language summary retains multiple distinct languages, certificate names/scores, proficiency, and handles no languages. Original had one conditional contains-language assertion; score loss always passed, and empty DEMO.languages caused zero assertions. Use explicit English/Japanese/Chinese records, exact entire summary and empty-list result. No conditionally skipped assertion.
- T254：Education honors include start/end boundary awards and exclude before/after/undated awards. Single matching award at a demo education start did not prove filtering at all: returning every award would pass. Use explicit dates and five awards; assert exact arrays for both education-ID and school+degree keys.
- T255：Unknown willingness yields no answer, explicit true/false yield exact decision objects, and unrelated questions are ignored. Original tested undefined plus one demo true value; expected text was derived from the same demo boolean and false/isAffirmative/unmatched branches were missing. Replace demo coupling with independent literal expected decision objects for true/false and two null outcomes.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T252 | 把工作和项目经历合并并按开始时间倒序排列 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileDeriver.test.ts#L11) |
| T253 | 汇总多语言能力且不丢失证书分数 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileDeriver.test.ts#L17) |
| T254 | 按教育时间挂靠荣誉 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileDeriver.test.ts#L24) |
| T255 | 未回答意愿题时拒绝盲猜 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileDeriver.test.ts#L32) |

## test/unit/profileNormalizer.test.ts

- T256：Major suffix normalization, exact finance lookup and unknown-major fallback produce expected paths. Software engineering lookup overlaps referenceCatalogs, but the 专业 suffix and unknown fallback are unique here. Keep these concrete cases; future consolidation can move suffix/fallback into the catalog table without losing them.
- T257：Short/suffixed city names resolve and an autonomous-region suffix is normalized. Catalog suite covers codes/districts, not these exact normalization inputs. Keep; no fabricated data table or mocked region resolver.
- T258：Degree alias maps to a offered option and missing doctorate option returns null. Positive and negative exact results. Empty candidate or substring ambiguity is not exercised. Keep. Blank option and misleading substring cases deserve coverage if matching logic changes.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T256 | 反查教育部专业门类路径 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileNormalizer.test.ts#L10) |
| T257 | 根据城市补全省市级联路径 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileNormalizer.test.ts#L16) |
| T258 | 把标准学历匹配到网站枚举文案 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/profileNormalizer.test.ts#L22) |

## test/unit/qaLearner.test.ts

- T259：删除静态 DEMO_RESUME 硬编码人名检查；保留 EMPTY_RESUME 无虚构信息、资料字段、开放问题、域名隔离/优先及经历上下文消歧。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T259 | EMPTY_RESUME 必须完全空净，严禁包含张三/假数据 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L10) |
| T260 | DEMO_RESUME 保持张三完整演示数据，用于演示测试 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L21) |
| T261 | 身高、体重、籍贯、户口、婚姻、到岗时间等应精准识别为 Profile 字段 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L28) |
| T262 | 开放式问题不属于 Profile 字段，返回 null 进入 QA 流程 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L38) |
| T263 | 标记为 scope: domain 的问答项，在异域网申时绝不会被填入 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L46) |
| T264 | 工作经历中的入职时间绝不误归档为 basics.availableTime | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L93) |
| T265 | 求职意向中的入职时间或显式到岗时间正确归档到 basics.availableTime | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L100) |
| T266 | 当同时存在 Global 通用回答与 Domain 专属回答时，专属回答必须优先命中胜出 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/qaLearner.test.ts#L108) |

## test/unit/referenceCatalogs.test.ts

- T267：保留版本化参考数据完整性和有歧义行政区/专业解析；固定 2026 版本数量用于检测数据截断，不当作站点支持数量。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T267 | covers all province-level groups and resolves less common districts, direct counties and Taiwan cities | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/referenceCatalogs.test.ts#L7) |
| T268 | does not match a different city merely because it shares the province | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/referenceCatalogs.test.ts#L17) |
| T269 | includes every 2026 undergraduate major, seven-digit codes and the new interdisciplinary ownership | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/referenceCatalogs.test.ts#L24) |

## test/unit/repeatedExperienceFill.test.ts

- T270：保留零卡异步、卡不增加、邻区/提交安全、根重建及 >5 上限。首例缩为每类2条，保持完整值/索引/幂等；40字段压力场景已由 Chromium 保留，避免同规模重复等待。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T270 | previews missing records without clicking, then adds and fills every record, including eight awards | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/repeatedExperienceFill.test.ts#L54) |
| T271 | starts at zero and waits for asynchronously rendered cards | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/repeatedExperienceFill.test.ts#L74) |
| T272 | stops after a button makes no progress and reports the exact missing record count | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/repeatedExperienceFill.test.ts#L89) |
| T273 | never uses a neighbouring section button or a submit button | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/repeatedExperienceFill.test.ts#L99) |
| T274 | refreshes configured roots too and removes the old five-click cap | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/repeatedExperienceFill.test.ts#L111) |

## test/unit/resolvers.test.ts

- T275：保留学历/政治/性别枚举、城市精确选项和日期有效性/格式/年月组/只读/至今/范围失败。域值不同于 DOM 执行，不能用一次 browser 正例取代。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T275 | 应该能将各类学历别名转换为标准 CanonicalDegree.BACHELOR | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L9) |
| T276 | 应该在页面实际存在的选项列表中精准匹配出真实 Option 字符串 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L18) |
| T277 | 应该正确处理政治面貌与性别归一化 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L28) |
| T278 | 应该能将各类中文与拼音别名归一化为标准省市 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L40) |
| T279 | 应该能从复杂下拉选项数组中匹配出复合城市选项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L54) |
| T280 | 应该能准确解析多样化日期字符串为 SemanticDate 结构 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L64) |
| T281 | formatDate 应该能输出各种格式要求 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L88) |
| T282 | injectSemanticDate 应该能正确注入年/月双下拉框组合 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L97) |
| T283 | native date 不应写入非法的“至今”，正常日期需读回确认且恢复只读状态 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L125) |
| T284 | 日期范围只在每个实际日期都写入成功时返回成功 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resolvers.test.ts#L140) |

## test/unit/resumeFieldRegistry.test.ts

- T285：Registry paths are unique; repeated bracket paths normalize to field definitions with explicit kind/group/privacy. Uniqueness invariant is legitimate rather than a tautology, although an empty registry alone would satisfy it; specific field assertions prevent that. Keep.
- T286：AI options include real false/zero/repeated values by path, exclude empty fields and private QA, and clipboard renders zero/false. Actual values are not serialized into AI options; exact known paths and absent name are meaningful integration checks. Keep. Full key projection could be stronger than a single name-leak negative, but dedicated privacy tests cover additional wrappers.
- T287：Schema-aware scrubbing redacts nested resume values and targetValue without erasing ordinary diagnostic field names. Extends privacyScrubber suite with nested wrapper path recognition and a positive diagnostic-preservation oracle. Keep; do not delete as superficial overlap with generic scrubber cases.
- T288：Manual bindings expose real repeated records and empty editable fields but no synthetic records, avatar or private QA. Concrete paths/label and private-answer exclusion distinguish manual bindings from value-only AI options. Keep as separate behavior, not a duplicate of AI option generation.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T285 | provides a unique normalized definition with type, group and privacy policy | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeFieldRegistry.test.ts#L9) |
| T286 | shares field coverage without sending resume values or domain QA to AI | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeFieldRegistry.test.ts#L15) |
| T287 | redacts actual schema data under nested resume wrappers without destroying diagnostic field labels | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeFieldRegistry.test.ts#L24) |
| T288 | manual bindings include real repeated records and empty editable fields, never synthetic or private QA paths | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeFieldRegistry.test.ts#L31) |

## test/unit/resumeImagePreparation.test.ts

- T289：Image validation accepts supported formats at size cap and rejects bad format, empty file and one byte over cap. Original accepted JPEG only, rejected a far-over-limit PNG and never reached WebP/PNG acceptance or zero/boundary branches. Type-cast fake File was unnecessary for Pick<File>. Validate JPEG/PNG/WebP at exact 12 MiB, reject 0 and cap+1, keep unsupported PDF check, remove casts. Actual decoding/resizing/canvas remains uncovered.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T289 | 接受常用图片格式并限制体积 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImagePreparation.test.ts#L5) |

## test/unit/resumeImportWorkflow.test.ts

- T290：Document enhancement and image parsing both reject absent explicit consent before any message is sent. Real orchestration with transport spy is the correct effect boundary; no model response mock can create consent. Keep both paths; positive image flow is not tested here.
- T291：Local parsing works with no settings read; AI failure returns that local parse with a useful error notice. Actual local parser result and independent settings/message boundaries catch AI coupling and lost fallback. Keep. Empty/scanned-document failure and disabled settings branches remain gaps.
- T292：AI result overrides nonempty facts, local values fill blanks, request includes approved source material, and preview causes no save. Original title claimed no auto-save without observing storage or persistence APIs. Spy on save/import methods, verify empty localStorage and single AI request with exact extracted text/file/image payload; keep change summary/local preview assertions.
- T293：Reset during deferred extraction aborts before an AI request and leaves no preview/busy state. Externally controlled extraction promise tests a genuine cancellation boundary. Keep. Scope disposal and image preparation cancellation are not simulated.
- T294：User can discard AI edits and restore the original local preview, clearing comparison state. Uses actual composable/service/parser; exact differing names prevent a no-op switch. Keep; distinct from service merge behavior.
- T295：A late AI response cannot overwrite a newer pasted-text preview or error state. Deferred transport creates actual stale-completion order; newer preview differs from response. Keep. Neither a fake clock nor a sleep is needed.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T290 | requires explicit consent for both external-processing paths | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L24) |
| T291 | keeps local parsing independent of AI and preserves it when enhancement fails | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L30) |
| T292 | merges AI structure with local missing fields without automatically saving it | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L41) |
| T293 | does not start an AI request after import has been discarded during extraction | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L58) |
| T294 | lets the user discard AI adjustments while keeping the local preview | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L74) |
| T295 | a late AI response cannot overwrite a newer pasted-text preview | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeImportWorkflow.test.ts#L88) |

## test/unit/resumeParser.test.ts

- T296：Implicit tenure/country/study format are not fabricated and do not enter AI candidate options. Real parser -> schema -> field mapper composition protects a meaningful cross-layer privacy/correctness contract. Keep; distinct from JSON/vision entrypoint default guards.
- T297：Explicit zero work years and non-full-time study survive parsing; zero stays an AI candidate. Concrete falsy values distinguish absent from supplied information. Keep. AI inclusion of isFullTime=false is covered less directly than workYears=0.
- T298：Chinese resume extracts identity, two education/jobs, project, skills, summary and descending chronology. Input was already newest-first, so deleting chronological sort passed; a skill count allowed arbitrary skill text. Put older education/job first and retain latest-first expected values; require exact seven skill names. Broad representative fixture is retained rather than split into redundant microtests.
- T299：Country-prefixed hyphenated phone and Chinese month dates normalize correctly. Uses different lexical forms from the representative resume; exact outputs. Keep as a real format regression.
- T300：Empty/noisy text yields blank basic fields and no education instead of crash or invented entries. Calls real parser with two adverse inputs; missing assertions for every group do not make core fallback checks worthless. Keep. Does not cover arbitrarily hostile input or performance.
- T301：Explicit skill proficiency is parsed while unmarked Python remains present with no level. python?.level===undefined also passed when the parser dropped Python entirely. Require a Python object with name and undefined level; keep positive Java/C++ proficiency checks.
- T302：Parsed internships do not fabricate employed job status. Only checked jobStatus || empty string; dropped experiences and undefined status both passed. Require two parsed internship records and exact empty status, preserving the no-inference regression.
- T303：Document type remains blank without an ID number and becomes 身份证 when a number is extracted. Positive/negative paired inputs exercise source-dependent behavior, not unconditional defaults alone. Keep.
- T304：Word-style escaped markdown, contact/family blocks, courses, structured internship, project/campus boundaries, language scores and extended groups parse together. Rich regression fixture with meaningful exact values; award/academic/campus checks are counts only and cannot catch wrong content. No Word file or Mammoth is exercised. Keep integrated fixture. Call it text-parser coverage; actual DOCX extraction remains a gap. Strengthen detailed group fields when those branches are changed.
- T305：Compact single-page PDF-like text handles split project names, campus rows, honors and skills. Real parser fixture asserts exact project names/order and skill names, but it is already-extracted text and does not load a PDF. Keep; complementary to spatial-layout tests, not a duplicate end-to-end PDF test.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T296 | 未声明的工龄、国家和学习形式保持未知，不能进入 AI 可填候选 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L7) |
| T297 | 明确的零年经验与非全日制仍然是有效答案 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L20) |
| T298 | 标准中文简历应该能精准提取所有模块字段 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L26) |
| T299 | 多样化手机号与异构日期格式应能被正确归一化 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L93) |
| T300 | 面对空文本、乱码或破坏性输入时，应能优雅降级 (Graceful Fallback) 而不崩溃 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L112) |
| T301 | 技能熟练度仅在原文明确写明时才提取，未写明时保持空值拒绝盲猜 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L123) |
| T302 | 纯实习经历不应被错误推算为社招在职，jobStatus 保持干净未填写 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L139) |
| T303 | 证件类型 idCardType 纯净性：未提取到身份证号时必须保持空字符串，提取到时赋值为身份证 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L150) |
| T304 | 应兼容 Word 转 Markdown 的转义、表格展平和项目内混排校园经历 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L169) |
| T305 | 应识别单页 PDF 的紧凑三列经历、多个项目章节和分号式荣誉列表 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeParser.test.ts#L278) |

## test/unit/resumeSchema.test.ts

- T306：v2 aliases and numeric height migrate into current v4 fields, including QA keyword/scope. Concrete renamed business fields prevent a version-number-only migration from passing. Keep. Other migrations/alias conflicts and strict:false recovery are not covered.
- T307：Unknown future versions and wrong known-array types are rejected. Two distinct reject branches share one short case; neither asserts only a generic truthy result. Keep. Finite numeric/boolean/location errors and version coercion remain gaps.
- T308：Unknown fields are stripped and product-format import rejects malformed education items. Positive unknown-field deletion plus a separate import-boundary failure. Minor cohesion issue but not tautological. Keep; shared schema error strings intentionally pin actionable field paths.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T306 | 按版本迁移旧字段名，而不是只覆盖 schemaVersion | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeSchema.test.ts#L6) |
| T307 | 拒绝未来版本和损坏的已知字段类型 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeSchema.test.ts#L25) |
| T308 | 导入时删除未知字段并拒绝损坏的数组项 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeSchema.test.ts#L36) |

## test/unit/resumeStorage.test.ts

- T309：Empty extension storage initializes the default entry/index without recursive save/read. Callback storage mock stores cloned real values; bounded get/set counts specifically guard the historical recursion path, rather than replacing it. Keep entry/index/value assertions. No real Chrome persistence claimed.
- T310：A saved edit survives a subsequent extension-storage read after initialization. Read count lower bound is weak and incidental, but name persistence and exact single-entry length are genuine behavior checks. Keep behavioral case; optional later cleanup can remove incidental read count without deleting persistence coverage.
- T311：Repeated saves under a fixed Date.now increase updatedAt monotonically and preserve newest content. Deterministic clock directly catches replacing monotonic timestamp logic with Date.now. No wall-clock race. Keep; clock spy is restored in finally.
- T312：Chrome runtime.lastError during set rejects save instead of reporting success. Faithful callback-lifetime error injection; real save path performs the check. Keep. It does not prove physical atomicity or read/remove failure handling.
- T313：Imported resume remains available after active ID selection and reread. Real import/schema/storage composition; exact ID/title/name checks distinguish stored user data from defaults. Keep. Deep array import coverage belongs to template/schema cases rather than duplicate mocks.
- T314：Broker serializes undefined as null and direct field patches preserve unrelated fields across sequential updates. Original fake sendMessage owned a Promise queue. Removing production enqueueResumeWrite in background.ts would have no effect: concurrency was supplied by the test itself. Removed fake queue and Promise.all; explicitly sequential calls through a JSON wire mock validate transport/patch semantics, including zero and deletion. Renamed test. This unit case does not verify cross-page queueing; the parent added a real Chromium two-page service-worker concurrency smoke check, whose execution is pending remote CI verification.
- T315：An empty localStorage array is repaired to a persisted default resume. Different backend and corruption state from the extension-first-install case; raw storage verifies repair, not only fallback return. Keep; do not merge away backend-specific initialization semantics.
- T316：Reading a future schema version yields a usable fallback without overwriting original local bytes. Exact original payload preservation guards destructive downgrade behavior. Keep. Equivalent Chrome-index/entry downgrade case remains untested.
- T317：Public save rejects a malformed education item. Uses real public save/schema integration. Same schema error as schema/import tests but a distinct write trust boundary. Keep; no mock of the validator.
- T318：The shipped public JSON template imports through the current storage API with expected current schema and populated groups. Reads an actual repository asset; catches template/code drift. Group lengths are weaker than content but adequate smoke support alongside dedicated mapping tests. Keep as an artifact compatibility contract, not a parser algorithm test.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T309 | 扩展空存储应直接写入默认简历，不递归调用读取 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L43) |
| T310 | 首装初始化后应能正常保存并重新读取简历 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L56) |
| T311 | 连续保存时 updatedAt 必须单调递增，保证预览失效校验可区分每次写入 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L72) |
| T312 | 浏览器拒绝写入时应明确报错，不能伪装成保存成功 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L97) |
| T313 | 解析导入的简历应在重新读取及恢复激活项后仍完整存在 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L112) |
| T314 | 跨页面交错更新应由 background 串行化并保留双方字段 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L128) |
| T315 | localStorage 中的空数组也应自动恢复默认简历 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L161) |
| T316 | 遇到未来版本时不得覆盖原始本地数据 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L172) |
| T317 | 保存入口应拒绝损坏的嵌套字段类型 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L183) |
| T318 | 公开下载的 JSON 模板应始终可以被当前版本直接导入 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/resumeStorage.test.ts#L192) |

## test/unit/ruleValidation.test.ts

- T319：保留合法、非法 CSS、非法 regex、存量坏规则隔离、hostname/path 防 query 欺骗，输入不可信配置边界。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T319 | 接受合法规则 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/ruleValidation.test.ts#L21) |
| T320 | 拒绝空或非法 CSS 选择器 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/ruleValidation.test.ts#L25) |
| T321 | 拒绝非法域名正则 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/ruleValidation.test.ts#L37) |
| T322 | 存量坏规则不会阻断其他页面的自动填写分析 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/ruleValidation.test.ts#L42) |
| T323 | 只按 hostname/path 边界匹配，不允许查询参数伪装成目标站点 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/ruleValidation.test.ts#L50) |

## test/unit/sectionWorkflow.test.ts

- T324：保留逐卡保存新增、重放篡改、直接/嵌套 submit 禁止和记录上限；精确状态顺序是该状态机的公开诊断契约且伴随实际点击与记录数。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T324 | 严格执行填写、保存、再新增，并对每一步保留验证轨迹 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/sectionWorkflow.test.ts#L33) |
| T325 | 即使文案为保存，也绝不点击 submit 类型按钮 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/sectionWorkflow.test.ts#L63) |
| T326 | 达到条数上限仍有剩余经历时，不得报告全部完成 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/sectionWorkflow.test.ts#L77) |
| T327 | 站点画像命中 submit 内层元素时也不得绕过安全门禁 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/sectionWorkflow.test.ts#L95) |

## test/unit/selectBehaviorAudit.test.ts

- T328：22 个控件状态用例使用事件处理后 committed 状态，涵盖同文案门户/隐藏/禁用、异步、IDREF、多选原子性、级联同名子级、Select2 代理。unit 可模拟分支，10 个关键正例再由真实扩展浏览器验证。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T328 | selects only the explicitly owned portal when another visible popup has the same text | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L63) |
| T329 | ignores a duplicate option whose ancestor is display:none | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L70) |
| T330 | skips an aria-disabled option and commits the enabled option with the same label | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L77) |
| T331 | waits for async search results to replace stale nonmatching options | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L84) |
| T332 | waits for a dynamically assigned popup association without clicking unrelated options | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L90) |
| T333 | accepts the whitespace-separated IDREF list allowed in aria-controls | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L97) |
| T334 | skips disabled native options and options inside disabled optgroups | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L103) |
| T335 | executes an array value as multiple native selections rather than a comma-joined label | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L109) |
| T336 | reads all committed native multi-select labels | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L117) |
| T337 | preserves every native multi-select value when one requested label does not exist | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L124) |
| T338 | rejects unsupported custom multi-select arrays before opening or toggling any choice | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L134) |
| T339 | does not toggle an already selected custom multi-select value off on replay | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L143) |
| T340 | limits cascader selection to the owned popup | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L150) |
| T341 | ignores empty cascader loading placeholders | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L157) |
| T342 | prefers an exact cascader label over a different partial-name branch | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L164) |
| T343 | does not select a different cascader branch when only a partial-name match exists | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L171) |
| T344 | waits for asynchronously loaded cascader children before selecting the next level | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L179) |
| T345 | chooses the next cascader column when parent and child have identical labels | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L186) |
| T346 | skips disabled cascader nodes | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L193) |
| T347 | reads SD committed sibling display text when its search input is empty | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L200) |
| T348 | searches the active Select2 portal and commits a label split by match-highlighting spans | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L207) |
| T349 | scans, plans, fills, and verifies one Select2 field without duplicating offscreen proxies | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/selectBehaviorAudit.test.ts#L216) |

## test/unit/similarityEngine.test.ts

- T350：保留编辑距离/Jaccard 数学边界和各语义类型高分/无关低分；分数阈值为匹配契约，但不是最终分类，38标签精确排名回归补足。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T350 | 相同字符串距离应为 0，完全不同字符串距离应正确 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L12) |
| T351 | 中文编辑距离计算正确 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L19) |
| T352 | 归一化相似度应在 0.0 ~ 1.0 之间 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L25) |
| T353 | 完全相同字符串重合度应为 1.0 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L33) |
| T354 | 包含关系的字符串应获得极高相似度打分 (>= 0.9) | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L37) |
| T355 | 空字符或完全无交集文本相似度应为 0.0 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L42) |
| T356 | 基础信息变体字段应能高置信度命中 (score >= 0.9) | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L49) |
| T357 | 政企/银行生僻字段应能准确命中 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L59) |
| T358 | 多段经历字段应能准确命中 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L66) |
| T359 | 完全无关的字段语义相似度应接近 0 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/similarityEngine.test.ts#L74) |

## test/unit/siteProfiles.test.ts

- T360：保留配置安全、27域路由/扫描、区块根、hostname/path、模板回退和 Ant 防误识别。原任意 semanticKey 成功改为每个 fixture 的准确 key 和 FILL。路由数量不冒充真实站点填写。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T360 | 所有内置画像均通过安全校验，且兼容目录完整引用现有 fixture | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L17) |
| T361 | 27 个 OfferLink 明确域名均有脱敏结构 fixture，并由画像约束扫描范围 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L34) |
| T362 | 相同根节点类可通过标题证据定位正确的重复区块 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L59) |
| T363 | 优先按 hostname/path 匹配，不把查询字符串当站点范围 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L69) |
| T364 | 未知企业域名可由共享 SaaS DOM 证据匹配 Phoenix 模板 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L75) |
| T365 | 不能把只有通用 Ant Select 的未知页面误识别成具体招聘站点 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L81) |
| T366 | 配置层拒绝提交或下一步一类危险动作 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/siteProfiles.test.ts#L86) |

## test/unit/snapshotRecorder.test.ts

- T367：删除无生产调用 replaySnapshot 的两个旧 API 例；保留脱敏计划、递归导出、run 隔离和导入验证，现代重放由 deterministicReplay 实测。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T367 | 规划快照不保存目标值或 DOM 引用 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L6) |
| T368 | 导出时再次递归脱敏 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L34) |
| T369 | 使用脱敏 scan 负载离线重跑并比较规划结果 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L41) |
| T370 | 按 runId 隔离并导出有界回放问题包 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L58) |
| T371 | 回放时使用定位证据重新找到重渲染后的控件 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L74) |
| T372 | 导入问题包时重新脱敏并拒绝无效结构 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/snapshotRecorder.test.ts#L97) |

## test/unit/textDateBehaviorAudit.test.ts

- T373：保留 beforeinput、精确 radio、form 隔离、取消 checkbox、脱离节点、同步/延迟验证、至今幂等、日期垃圾/格式、手动/自动日历入口、范围回读、fallback取消。每条对应不同失败机制。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T373 | honors beforeinput cancellation before changing a text control | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L13) |
| T374 | selects an exact radio option rather than its opposite containing the same word | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L22) |
| T375 | scopes same-name radio options to their owning form | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L27) |
| T376 | does not force a checkbox on after its click was prevented | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L33) |
| T377 | does not report success from a detached input after a controlled rerender | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L40) |
| T378 | reports a page validation error even when displayed text matches | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L50) |
| T379 | does not toggle an already-selected current-employment checkbox off | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L59) |
| T380 | rejects dates containing trailing junk rather than partially parsing them | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L64) |
| T381 | manual date entry commits the readonly calendar value | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L68) |
| T382 | pipeline date entry commits the readonly calendar value | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L68) |
| T383 | does not count a value rejected by debounced blur validation as successful | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L78) |
| T384 | reads the selected current-date checkbox as the end of a date range | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L87) |
| T385 | compares month-first date displays without accepting malformed identical dates | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L93) |
| T386 | does not bypass cancelled input through a later fallback strategy | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/textDateBehaviorAudit.test.ts#L98) |

## test/unit/trackerStorage.test.ts

- T387：Fresh reads return no applications and do not seed fabricated tracker data. Exact output and raw absent storage key are independent useful oracles. Keep; no need for additional mocked empty-storage tests.
- T388：Legacy application read upgrades schema, idempotency and sync metadata and removes tracking query parameters. Original only checked returned normalization; deleting the migration write-back would pass. Assert raw persisted JSON equals the migrated record, in addition to returned metadata/URL.
- T389：A javascript URL is not stored as a clickable job URL. Uses real normalizer and storage, rather than mocking URL rejection. Keep. Other unsafe schemes and malformed relative URLs are separate gaps, not proved here.
- T390：Concurrent saves do not lose independent records; retries deduplicate by request ID and normalized job identity; user company survives heuristic overwrite. Unlike resumeStorage concurrency test, this one reaches production withWriteLock. The microtask race is real because reads await before writes. Keep. Broker/background cross-context serialization is not established by this same-module case.
- T391：Extension reads route through GET and SAVE transports explicit-clear user provenance and locked fields. Old SAVE assertion inspected only its type; payload could be empty and the entire test passed. Fake response never persisted edits. Round-trip outgoing messages through JSON; require exact clear metadata, user source, application ID, and absent notes value. Title now promises transport only. The next case proves persisted merge behavior.
- T392：An explicit user-cleared field stays empty across a later automatic retry, keeping user provenance and lock. Three real storage operations exercise competing source priorities; useful negative value plus positive metadata assertions. Keep. Distinct from the broker transport test.
- T393：A saved draft is readable until expiry and is physically removed at the TTL boundary. Creating a different already-expired draft only exercised a negative TTL and never passage of time or deletion. Use fake clock: same draft at 9,999 ms, null and empty localStorage at 10,000 ms; restore real timers afterward.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T387 | 首次打开为空，不再写入虚构公司和岗位 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L10) |
| T388 | 迁移旧记录并生成 schema、幂等键和本地同步状态 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L15) |
| T389 | 拒绝把非 HTTP(S) 地址保存为可点击岗位链接 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L25) |
| T390 | 并发保存被串行化，并按 clientRequestId/岗位身份防重复 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L33) |
| T391 | 扩展页面经 background 访问 Tracker，并保留显式清空字段的用户来源 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L60) |
| T392 | 用户显式清空的字段保持为空，后续页面抽取不能覆盖 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L92) |
| T393 | 申请成功草稿可恢复，并在 TTL 到期后自动清除 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trackerStorage.test.ts#L120) |

## test/unit/trieMatcher.test.ts

- T394：保留基本/去重/短词/长文本结果；基本命中改为精确全列表，负例补 R。删除过的机器时间断言不恢复，长文本不宣称复杂度证明。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T394 | 应该能正确构建字典树并实现基本关键词命中 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trieMatcher.test.ts#L11) |
| T395 | searchUnique 应该返回去重后的命中关键词列表 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trieMatcher.test.ts#L26) |
| T396 | 针对短词（<=3 字符，如 Go, C, R）应进行词边界检查，避免单词内部误伤 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trieMatcher.test.ts#L39) |
| T397 | 长文本重复命中应完整，不把单次机器耗时当复杂度证明 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/trieMatcher.test.ts#L60) |

## test/unit/visionResumeImporter.test.ts

- T398：Fenced model JSON and legacy field aliases normalize into a usable StandardResume with generated education ID. Real extraction/normalization/import stack, concrete values and a generated ID prefix. Only one repeated group ID is explicitly asserted. Keep. Malformed JSON, invalid known fields and duplicate/unique metadata deserve targeted future cases if touched.
- T399：Omitted visual facts remain unknown after model-response normalization. Independent untrusted input route from JSON Resume/text; not redundant merely because output assertions resemble those suites. Keep.
- T400：Only checked that generated prompt text contained two Chinese phrases. Two substrings do not prove prompt wiring, semantic instructions, model compliance, or safe downstream behavior. Negated/reversed instructions containing them still pass. Deleted standalone wording test and unused buildVisionResumePrompt import. Consent, parse/merge and actual request boundaries remain covered.
- T401：A model response without a JSON object gives a readable error. Concrete no-object branch, independent of positive fenced JSON case. Keep. Does not cover syntactically invalid JSON.
- T402：AI keeps precedence for present values; local data fills blanks, omitted rows and local-only QA while preserving input objects. Original said omitted entries but contained exactly one matching education on each side. No missing row, false/zero or input immutability oracle. Added unmatched local education, missing course/email, conflicting true/5 versus AI false/0, local QA; assert exact retained row, merged values, chosen metadata and unchanged inputs.

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T398 | 把视觉模型 JSON 收敛成带本地 ID 的 StandardResume | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/visionResumeImporter.test.ts#L6) |
| T399 | 视觉结果未提供的信息不在本地补成用户事实 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/visionResumeImporter.test.ts#L24) |
| T400 | 提示词要求把图片内容仅视为数据并禁止猜测 | delete | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/visionResumeImporter.test.ts#L32) |
| T401 | 没有 JSON 时给出可读错误 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/visionResumeImporter.test.ts#L38) |
| T402 | AI 结果为主并用本地解析补空值和遗漏条目 | rewrite | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/visionResumeImporter.test.ts#L42) |

## test/unit/workday.test.ts

- T403：保留姓名三种解析、父层/本控件 data-automation-id、通用 firstName 映射；各结构差异确实可能分别退化。不是实时 Workday 申请验收。

| ID | 原用例 | 处置 | 基线源码 |
|---|---|---|---|
| T403 | 中文单字姓氏应能正确拆分为 lastName 和 firstName | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L14) |
| T404 | 中文复姓（如诸葛、欧阳）应能精准识别并拆分 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L21) |
| T405 | 英文格式姓名（如 Johnathan Smith）应能按空格正确拆分 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L28) |
| T406 | Workday 结构化表单中的 legalNameSection 应精准映射到 firstName 与 lastName | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L37) |
| T407 | 当 data-automation-id 直接挂在 input 上时，WorkdayEnhancer 同样必须精准识别 | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L102) |
| T408 | 通用语义词典面对 First Name / Given Name 时，绝对只能匹配 basics.firstName，绝不能填入 Full Name | retain | [查看](https://github.com/linkingoscar/openjobfill/blob/2f7b1ccb7b772bf83d401bd7ae9ac79bfd2ed30a/test/unit/workday.test.ts#L148) |
