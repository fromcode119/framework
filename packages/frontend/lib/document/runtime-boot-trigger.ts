/**
 * Decides WHEN the storefront runtime script is appended to an islands document.
 *
 * The document is complete server HTML: layout, blocks, styles and CSS animations all work before a
 * single script runs. Booting the runtime is the one large piece of main-thread work on the page —
 * evaluating the bundles and hydrating the whole tree is a 300 ms+ task on a mid-range phone — and
 * running it straight after `load` put that task inside the window where the page is being looked at,
 * which is what held mobile scores in the 80s and 90s (Speed Index counts every late layout, Total
 * Blocking Time every long task) while the same page with no script at all scored 100.
 *
 * So the runtime boots on the visitor's FIRST sign of intent — a pointer, a key, a touch, a scroll —
 * which is the moment its work becomes useful, or once the page has sat idle for
 * {@link IDLE_FALLBACK_MS}, so a visitor who only reads still gets every interactive surface, consent
 * banner and analytics beacon. A tap that arrives before the runtime is ready is held and replayed by
 * `EarlyInteractionBuffer`, so nothing the visitor does is lost.
 *
 * {@link bootstrap} is serialised with `Function.prototype.toString()`, like `EarlyInteractionBuffer`:
 * it must stay self-contained — only its parameters and browser globals.
 */
export class RuntimeBootTrigger {
  /** Events that mean the visitor is about to do something the runtime handles. */
  static readonly INTENT_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove', 'focusin'] as const;

  /** How long after `load` a page nobody touches waits before booting anyway. */
  static readonly IDLE_FALLBACK_MS = 5000;

  /** The idle slice the fallback then waits for, at most. */
  static readonly IDLE_TIMEOUT_MS = 2000;

  static bootstrap(scriptPath: string, events: readonly string[], fallbackMs: number, idleTimeoutMs: number): void {
    let booted = false;
    const boot = (): void => {
      if (booted) return;
      booted = true;
      events.forEach((name) => removeEventListener(name, boot, true));
      const script = document.createElement('script');
      script.src = scriptPath;
      script.async = true;
      document.head.appendChild(script);
    };
    events.forEach((name) => addEventListener(name, boot, { capture: true, passive: true }));
    const fallback = (): void => {
      setTimeout(() => {
        if (window.requestIdleCallback) window.requestIdleCallback(boot, { timeout: idleTimeoutMs });
        else boot();
      }, fallbackMs);
    };
    if (document.readyState === 'complete') fallback();
    else addEventListener('load', fallback, { once: true });
  }

  /** The IIFE for the inline `<script>`. */
  static inlineScript(scriptPath: string): string {
    const args = [scriptPath, RuntimeBootTrigger.INTENT_EVENTS, RuntimeBootTrigger.IDLE_FALLBACK_MS, RuntimeBootTrigger.IDLE_TIMEOUT_MS]
      .map((value) => JSON.stringify(value)).join(',');
    return `(function ${RuntimeBootTrigger.bootstrap.toString()})(${args});`;
  }
}
