import { afterEach, describe, expect, it } from 'vitest';
import { createPageFocusTracker } from '@/core/ui/pageFocus';

describe('clipboard page focus', () => {
  const trackers: ReturnType<typeof createPageFocusTracker>[] = [];
  afterEach(() => { trackers.forEach((tracker) => tracker.stop()); document.body.replaceChildren(); });
  function setup() {
    document.body.innerHTML = '<input id="candidate"><div id="openjobfill-extension-host"></div><button id="page-button">Next</button>';
    const input = document.querySelector<HTMLInputElement>('#candidate')!;
    const shadow = document.querySelector('#openjobfill-extension-host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input id="search"><button>Copy</button>';
    const tracker = createPageFocusTracker(); trackers.push(tracker); tracker.start();
    return { input, shadow, tracker };
  }
  it('retains the page destination through extension search and keyboard button focus', () => {
    const { input, shadow, tracker } = setup();
    input.focus(); shadow.querySelector<HTMLInputElement>('input')!.focus();
    expect(tracker.getTarget()).toBe(input);
    shadow.querySelector<HTMLButtonElement>('button')!.focus();
    expect(tracker.getTarget()).toBe(input);
  });
  it('forgets the destination when the user focuses another page control', () => {
    const { input, tracker } = setup(); input.focus();
    document.querySelector<HTMLButtonElement>('#page-button')!.focus();
    expect(tracker.getTarget()).toBeNull();
  });
  it.each(['removed', 'disabled', 'readonly', 'password', 'captcha', 'hidden'])('revalidates a %s destination after a page update', (state) => {
    const { input, shadow, tracker } = setup(); input.focus(); shadow.querySelector<HTMLButtonElement>('button')!.focus();
    if (state === 'removed') input.remove();
    if (state === 'disabled') input.disabled = true;
    if (state === 'readonly') input.readOnly = true;
    if (state === 'password') input.type = 'password';
    if (state === 'captcha') input.name = 'captcha';
    if (state === 'hidden') input.hidden = true;
    expect(tracker.getTarget()).toBeNull();
  });
});
