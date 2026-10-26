// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeBootHintConstants } from '@fromcode119/core/client';
import { RuntimeBootTrigger } from '@/lib/document/runtime-boot-trigger';

/**
 * The runtime used to boot straight after `load`, putting its evaluation and hydration task inside the
 * window a page is scored on. It now boots on the visitor's first sign of intent, or after an idle
 * fallback for a visitor who only reads.
 */
const SCRIPT = '/fc-runtime/runtime-test.js';
const runtimeScripts = (): number => document.head.querySelectorAll(`script[src="${SCRIPT}"]`).length;
const install = (): void => {
  // Exactly what the document ships: the serialised inline script.
  new Function(RuntimeBootTrigger.inlineScript(SCRIPT))();
};

beforeEach(() => {
  vi.useFakeTimers();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RuntimeBootTrigger', () => {
  it('does not boot at load, and boots once on the first intent event', () => {
    install();
    vi.advanceTimersByTime(RuntimeBootTrigger.IDLE_FALLBACK_MS - 1);
    expect(runtimeScripts()).toBe(0);

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(runtimeScripts()).toBe(1);

    vi.runAllTimers();
    expect(runtimeScripts()).toBe(1);
  });

  it('boots after the idle fallback when nobody interacts', () => {
    install();
    vi.advanceTimersByTime(RuntimeBootTrigger.IDLE_FALLBACK_MS + RuntimeBootTrigger.IDLE_TIMEOUT_MS);
    vi.runAllTimers();
    expect(runtimeScripts()).toBe(1);
  });

  it('boots at once when the document carries a surface waiting on the runtime', () => {
    document.body.innerHTML = `<section ${RuntimeBootHintConstants.ATTRIBUTE}>Loading…</section>`;
    install();
    expect(runtimeScripts()).toBe(1);

    vi.runAllTimers();
    window.dispatchEvent(new Event('pointerdown'));
    expect(runtimeScripts()).toBe(1);
  });
});
