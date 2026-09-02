import type { FieldDescriptor } from '../../types/pipeline';
import { isInputElement } from '../../utils/dom';

export type SensitiveFieldCategory = 'credential' | 'verification' | 'payment' | 'dangerous-action';

export interface FieldSafetyInfo {
  blocked: boolean;
  category?: SensitiveFieldCategory;
  reason?: string;
}

const CREDENTIAL_TERMS = /密码|口令|password|passwd|登录密码|确认密码|找回密码|验证码|captcha|verify|安全码|security\s*code|one[-\s]?time\s*password|\botp\b/i;
const PAYMENT_TERMS = /银行卡|信用卡|卡号|支付|付款|收款|银行账号|bank\s*card|credit\s*card|card\s*number|cvv|cvc|expiry|billing/i;
const DANGEROUS_ACTION_TERMS = /提交申请|立即投递|确认投递|支付确认|删除账号|注销账号|登录|sign\s*in|log\s*in|submit application|apply now/i;

function textFor(el: HTMLElement, label = '', context = ''): string {
  const input = isInputElement(el) ? el : null;
  return [
    label,
    el.getAttribute('name') || '',
    el.id || '',
    el.getAttribute('placeholder') || '',
    el.getAttribute('aria-label') || '',
    input?.type || '',
    context,
  ].join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Central safety gate shared by analyzer, executor and manual fill. Context is
 * restricted to the field's nearby form container by PageAnalyzer callers.
 */
export function inspectFieldSafety(
  el: HTMLElement,
  label = '',
  context = '',
): FieldSafetyInfo {
  if (!el) return { blocked: true, category: 'dangerous-action', reason: '目标控件不存在' };
  const input = isInputElement(el) ? el : null;
  const type = (input?.type || '').toLowerCase();
  const text = textFor(el, label, context);

  if (type === 'password' || CREDENTIAL_TERMS.test(text)) {
    return { blocked: true, category: 'credential', reason: '疑似密码、验证码或登录凭据字段，安全策略禁止自动写入' };
  }
  if (PAYMENT_TERMS.test(text)) {
    return { blocked: true, category: 'payment', reason: '疑似支付或银行卡字段，安全策略禁止自动写入' };
  }
  if (DANGEROUS_ACTION_TERMS.test(text)) {
    return { blocked: true, category: 'dangerous-action', reason: '疑似登录或提交操作，安全策略禁止自动写入' };
  }
  return { blocked: false };
}

export function isSensitiveField(field: Pick<FieldDescriptor, 'element' | 'label' | 'contextText' | 'safety'>): boolean {
  if (field.safety?.blocked) return true;
  return inspectFieldSafety(field.element, field.label, field.contextText).blocked;
}

