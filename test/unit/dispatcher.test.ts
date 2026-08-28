import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setNativeValue,
  setNativeRadioChecked,
  setNativeCheckboxChecked,
  simulateClick,
} from '@/core/engine/dispatcher';

describe('Dispatcher (受控组件穿透与原生原型链劫持引擎)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('应该能穿透设置 HTMLInputElement 的值并派发完整事件链', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const inputEvents: string[] = [];
    input.addEventListener('focus', () => inputEvents.push('focus'));
    input.addEventListener('beforeinput', () => inputEvents.push('beforeinput'));
    input.addEventListener('input', () => inputEvents.push('input'));
    input.addEventListener('change', () => inputEvents.push('change'));
    input.addEventListener('blur', () => inputEvents.push('blur'));

    const success = setNativeValue(input, '张三');

    expect(success).toBe(true);
    expect(input.value).toBe('张三');
    expect(inputEvents).toContain('input');
    expect(inputEvents).toContain('change');
    expect(inputEvents).toContain('blur');
  });

  it('应该能穿透设置 HTMLTextAreaElement 的值', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const success = setNativeValue(textarea, '这是详细的项目经验描述。');

    expect(success).toBe(true);
    expect(textarea.value).toBe('这是详细的项目经验描述。');
  });

  it('针对 React 的 _valueTracker 应该能正确重置以触发 React 受控状态更新', () => {
    const input = document.createElement('input');
    let trackerValue = 'initial';

    // 模拟 React 内部注入的 _valueTracker 机制
    (input as any)._valueTracker = {
      getValue: () => trackerValue,
      setValue: (val: string) => {
        trackerValue = val;
      },
      stopTracking: () => {},
    };

    setNativeValue(input, '李四');

    expect((input as any)._valueTracker.getValue()).toBe('');
    expect(input.value).toBe('李四');
  });

  it('setNativeRadioChecked 应能正确设置单选框 checked 状态并触发 change 事件', () => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'gender';
    radio.value = '男';
    document.body.appendChild(radio);

    let changed = false;
    radio.addEventListener('change', () => {
      changed = true;
    });

    const success = setNativeRadioChecked(radio, true);

    expect(success).toBe(true);
    expect(radio.checked).toBe(true);
    expect(changed).toBe(true);
  });

  it('setNativeCheckboxChecked 应能正确设置复选框 checked 状态', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.appendChild(checkbox);

    let changed = false;
    checkbox.addEventListener('change', () => {
      changed = true;
    });

    const success = setNativeCheckboxChecked(checkbox, true);

    expect(success).toBe(true);
    expect(checkbox.checked).toBe(true);
    expect(changed).toBe(true);
  });

  it('simulateClick 应派发完整的 mousedown/mouseup/click 序列', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    const events: string[] = [];
    btn.addEventListener('mousedown', () => events.push('mousedown'));
    btn.addEventListener('mouseup', () => events.push('mouseup'));
    btn.addEventListener('click', () => events.push('click'));

    // happy-dom scrollIntoView mock
    btn.scrollIntoView = vi.fn();

    simulateClick(btn);

    expect(events).toEqual(['mousedown', 'mouseup', 'click']);
  });
});
