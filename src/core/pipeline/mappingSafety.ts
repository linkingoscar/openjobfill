import { findAssociatedLabelText } from '../../utils/dom';

/** Shared guard for mapping routes: site rules must not outrank field identity. */
export function mappingSafetyReason(
  element: HTMLElement,
  resumeKey: string,
  label = '',
): string | null {
  if (!resumeKey.startsWith('basics.') || /^basics\.emergencyContact(?:Name|Phone|Relation)$/.test(resumeKey)) return null; // Explicit family/emergency data stays usable.
  const liveLabel = findAssociatedLabelText(element);
  const evidence = [liveLabel, label, element.getAttribute('aria-label'),
    element.getAttribute('placeholder'), element.getAttribute('name'), element.id]
    .filter(Boolean).join(' ');
  const otherPerson = /紧急联系人|推荐人|证明人|担保人|家属|家庭成员|父亲|母亲|配偶|亲属|监护人|emergency|referee|reference|referral|recommender|father|mother|guardian|spouse|relative|family[\s_-]*(?:member|contact)/i;
  if (otherPerson.test(evidence)) return '该字段属于他人，不能使用本人信息';
  if (resumeKey === 'basics.name') {
    if (/用户名|昵称|登录名|账号|user[\s_-]*name|nick[\s_-]*name|login[\s_-]*(?:name|id)|account/i.test(evidence)) {
      return '账号名称不能使用本人姓名自动匹配';
    }
    if (/学校|院校|大学|公司|企业|专业|项目|school|university|college|company|employer|major|project/i.test(evidence)) {
      return '学校、公司、专业或项目名称不能使用本人姓名';
    }
  }
  return null;
}
