# 复杂控件 Adapter Runtime 与兼容矩阵

OpenJobFill 以行为分析后的独立实现承接成熟插件的复杂控件经验，不复制压缩或反编译代码。

## 执行顺序

```text
FillPlan
  → 站点专项 Adapter
  → 组件库 Adapter
  → 通用 Driver
  → Native Fallback
  → 专属 Read-back
  → Verify / Remaining Tasks
```

所有 Adapter 统一进入 `match → write → readBack → verify` 闭环。`write` 返回未处理时才允许继续降级；写入后必须读回页面状态，不能把一次点击当作成功。已有值保护、安全字段闸门、AbortSignal、runId/page fingerprint 和禁止自动提交继续由现有 Pipeline 统一负责。

## 58 项目录

| 行为族 | Adapter |
| --- | --- |
| 搜索/普通下拉 | MeituanMtdSelect、AntSelectSearchInput、HotjobLinkedAntSelect、AntSelect、ZhaopinCampusElementSelect、GreeyunElementSelect、ElementSelect、AUISelect、ElementAutocomplete、PhoenixSelect、AtsxSelect、UdSelect、TpLinkSelectBox、MokahrSearchDropdown、MokahrSimpleDropdown、SdDropdown、LayUISelect、IViewSelect、ZhipinSelect、Job51LinkedSelect、Job51ComboboxSelect、NativeSelect、BankCommPopPanel、ZhipinDialog |
| 多级联动 | HotjobMajorModal、GuoPinAntCascader、AntCascader、Job51ThreeLayerSelect、ZhaopinCampusRegionCascader、ElementCascader、HcSuperSelector、MokahrRegionDropdown、IViewCascader、ShixisengCity、TpLinkEthnicPicker |
| 日期/区间 | MeituanMtdMonthPicker、AntDateRangePicker、AntDatePicker、ZhaopinCampusDateInput、ElementDatePicker、AtsxDatePicker、TpLinkDatePicker、MokahrDateDropdown、ZhipinDatePicker、LagouCalendarPicker、DateRangeCalendar、ThundersoftFeishuMonthRange、MokahrSingleMonth、MokahrMonthRange、Job51SetdayDate、My97Date |
| 文本/富文本/组合输入 | PhoenixInput、SdInput、LagouEditor、Job51PhoneField、Job51Input |
| 选择状态 | CheckboxInput、RadioGroup |

目录名称与参考产品的 58 项一一对应；底层实现按行为族复用，避免复制 58 套等待、取消、事件和验证代码。

## MAIN world 边界

仅 Phoenix、HcSuperSelector、51Job Setday 和 My97 等确有页面上下文需求的 Adapter 可请求 MAIN world。桥接协议只开放：

- `TYPE`
- `SELECT_TEXT`
- `SELECT_PATH`

每次调用必须先从 Background 获取 15 秒有效的一次性 token，并绑定来源 tab、frame、runId 和 requestId。Background 在消息来源 frame 中执行固定打包函数，不接受任意 JavaScript、任意事件名、提交、保存或下一步动作。

## 支持状态口径

- `REGISTERED`：已进入唯一目录并具备确定的匹配证据。
- `ROUTE_VERIFIED`：本地结构契约确认扫描器与路由器能够实际到达该 Adapter，而不是只有一个未使用的登记名。
- `FIXTURE_VERIFIED`：本地代表性 DOM 已通过写入与回读测试。
- `SITE_VERIFIED`：在对应站点当前版本完成实际页面验证。

本轮已完成 58 项 `REGISTERED + ROUTE_VERIFIED`，并对 Native、Ant/Element/Semi 通用控件、Moka 搜索下拉、51Job 组合电话与三层联动、TP-Link 民族选择、交通银行弹层、My97 日期、富文本、日期区间、Radio/Checkbox、Shadow DOM 以及 MAIN-world 消息协议建立自动化覆盖。纯 `div` 触发器也纳入页面扫描和 Driver 分类回归。站点专属项仍需按真实页面版本逐项升级为 `SITE_VERIFIED`，不能仅凭本地结构契约宣称线上完全适配。

站点流程不再混入本目录：27 个 hostname/path/SaaS 模板画像、Save-before-next/单卡工作流和 Fixture 引用由 [`site-profile-compatibility-lab.md`](site-profile-compatibility-lab.md) 管理。Adapter 通过不等于站点通过，两项门禁必须分别满足。

## 维护准则

1. 新 selector 必须限定在字段自身或祖先控件根，不允许从字段退化到全文档第一个匹配项。
2. 站点专属 Adapter 的优先级高于组件库 Adapter；Native fallback 永远最后。
3. selector 命中、Adapter 尝试、执行 world、回读失败都进入脱敏诊断，不记录简历目标值。
4. 平台组件升级后先增加失败 fixture，再更新匹配或驱动。
5. 未验证成功的字段进入待办清单，不自动点击提交或推进页面步骤。
