// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarlyInteractionBuffer } from '@/lib/document/early-interaction-buffer';

/**
 * A tap made before the storefront runtime has booted used to do nothing: the islands document is
 * server HTML and its buttons have no listeners until `hydrateRoot`. The buffer holds such taps and
 * the runtime plays them back once it has mounted.
 */
const boot = (): void => {
  // Exactly what the document ships: the serialised inline script.
  new Function(EarlyInteractionBuffer.inlineScript())();
};

afterEach(() => {
  EarlyInteractionBuffer.release();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('EarlyInteractionBuffer', () => {
  it('holds a button tap made before the runtime boots and plays it back once, after release', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="fc-root"><div><button type="button">Order now</button></div></main>';
    const button = document.querySelector('button') as HTMLButtonElement;
    boot();

    button.click();
    button.click();
    expect(button.hasAttribute(EarlyInteractionBuffer.PENDING_ATTRIBUTE)).toBe(true);

    // The runtime mounts and attaches its handler; only then is the tap delivered.
    const handler = vi.fn();
    button.addEventListener('click', handler);
    EarlyInteractionBuffer.release();
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute(EarlyInteractionBuffer.PENDING_ATTRIBUTE)).toBe(false);
  });

  it('leaves links, inputs and labels to the browser', () => {
    document.body.innerHTML = '<a href="/blog">Blog</a><label><input type="checkbox"> Agree</label>';
    boot();
    const link = document.querySelector('a') as HTMLAnchorElement;
    const box = document.querySelector('input') as HTMLInputElement;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(false);
    box.click();
    expect(box.checked).toBe(true);
  });

  it('holds a form submission and submits it after release', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<form><input name="q"><button type="submit">Send</button></form>';
    const form = document.querySelector('form') as HTMLFormElement;
    boot();
    const early = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(true);

    const requestSubmit = vi.spyOn(form, 'requestSubmit').mockImplementation(() => undefined);
    EarlyInteractionBuffer.release();
    vi.runAllTimers();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('finds the control at the same place when the page was re-rendered before playback', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="fc-root"><section><button type="button">Order now</button></section></main>';
    boot();
    (document.querySelector('button') as HTMLButtonElement).click();

    // The fallback path replaces the markup with a freshly rendered copy.
    document.body.innerHTML = '<main id="fc-root"><section><button type="button">Order now</button></section></main>';
    const fresh = document.querySelector('button') as HTMLButtonElement;
    const handler = vi.fn();
    fresh.addEventListener('click', handler);

    EarlyInteractionBuffer.release();
    vi.runAllTimers();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops holding after release, so later taps go straight through', () => {
    document.body.innerHTML = '<button type="button">Later</button>';
    boot();
    EarlyInteractionBuffer.release();
    const button = document.querySelector('button') as HTMLButtonElement;
    const handler = vi.fn();
    button.addEventListener('click', handler);
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
