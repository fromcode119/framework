/**
 * Keeps what a visitor does before the storefront runtime has booted.
 *
 * The islands document is server HTML; its buttons work only once the runtime script has loaded and
 * `hydrateRoot` has attached React's listeners. On a slow phone that is several seconds, and a tap on
 * "Order now" in that window did nothing at all — no error, no feedback, and the visitor assumes the
 * shop is broken. React replays events that arrive DURING hydration; nothing caught the ones that
 * arrived before it.
 *
 * {@link bootstrap} runs as a synchronous inline `<script>` in `<head>`, so it is listening before the
 * first paint. It holds back clicks on controls that need JavaScript (buttons, and elements with a
 * button role) and form submissions, and marks each held control. Links, inputs, selects and labels
 * are left alone: the browser already does the right thing with them. {@link release} is called by the
 * runtime right after it mounts, and plays the held interactions back on the same elements — or, if
 * the page was re-rendered on the fallback path, on the element now at the same place.
 *
 * {@link bootstrap} is serialised with `Function.prototype.toString()`, like `ColorSchemeBootScript`:
 * it must stay self-contained — only its parameters and browser globals.
 */
export class EarlyInteractionBuffer {
  /** Where the inline script keeps its state for the runtime to find. */
  static readonly GLOBAL_KEY = '__fcEarlyInteractions';

  /** Set on a control whose click is being held; removed when it is played back. */
  static readonly PENDING_ATTRIBUTE = 'data-fc-pending';

  /** How long playback waits for a fallback re-render to put the control back, in 50 ms steps. */
  private static readonly RETRY_LIMIT = 100;

  static bootstrap(globalKey: string, pendingAttribute: string): void {
    const controlSelector = 'button,[role="button"],input[type="submit"],input[type="button"],input[type="image"]';
    const held: Array<{ element: Element; path: string; submit: boolean }> = [];
    const pathOf = (element: Element): string => {
      const parts: string[] = [];
      let node: Element | null = element;
      while (node && node !== document.documentElement) {
        if (node.id) { parts.unshift(`[id="${node.id.replace(/["\\]/g, '\\$&')}"]`); break; }
        const parent: Element | null = node.parentElement;
        const index = parent ? Array.prototype.indexOf.call(parent.children, node) + 1 : 1;
        parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
        node = parent;
      }
      return parts.join('>');
    };
    const hold = (element: Element, submit: boolean): void => {
      if (!held.some((entry) => entry.element === element)) held.push({ element, path: pathOf(element), submit });
      element.setAttribute(pendingAttribute, '');
      element.setAttribute('aria-busy', 'true');
    };
    const onClick = (event: Event): void => {
      const target = event.target as Element | null;
      const control = target && target.closest ? target.closest(controlSelector) : null;
      if (!control || (control as HTMLButtonElement).disabled || control.closest('a[href]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hold(control, false);
    };
    const onSubmit = (event: Event): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.target instanceof HTMLFormElement) hold(event.target, true);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    (window as unknown as Record<string, unknown>)[globalKey] = {
      held,
      stop: (): void => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('submit', onSubmit, true);
      },
    };
  }

  /** The IIFE for the inline `<script>`. */
  static inlineScript(): string {
    return `(function ${EarlyInteractionBuffer.bootstrap.toString()})(${JSON.stringify(EarlyInteractionBuffer.GLOBAL_KEY)},${JSON.stringify(EarlyInteractionBuffer.PENDING_ATTRIBUTE)});`;
  }

  /**
   * Stop holding and play back what was held. Called once, right after the runtime mounts: React's
   * listeners are attached by then, and a click on a boundary still hydrating is one React replays.
   */
  static release(win: Window = window): void {
    const bag = win as unknown as Record<string, { held: Array<{ element: Element; path: string; submit: boolean }>; stop: () => void } | undefined>;
    const state = bag[EarlyInteractionBuffer.GLOBAL_KEY];
    if (!state) return;
    bag[EarlyInteractionBuffer.GLOBAL_KEY] = undefined;
    state.stop();
    for (const entry of state.held) {
      entry.element.removeAttribute(EarlyInteractionBuffer.PENDING_ATTRIBUTE);
      entry.element.removeAttribute('aria-busy');
      EarlyInteractionBuffer.playBack(win, entry, 0);
    }
  }

  private static playBack(win: Window, entry: { element: Element; path: string; submit: boolean }, attempt: number): void {
    win.setTimeout(() => {
      const element = entry.element.isConnected ? entry.element : win.document.querySelector(entry.path);
      if (!element) {
        if (attempt < EarlyInteractionBuffer.RETRY_LIMIT) EarlyInteractionBuffer.playBack(win, entry, attempt + 1);
        return;
      }
      if (entry.submit && element instanceof win.HTMLFormElement) element.requestSubmit();
      else (element as HTMLElement).click();
    }, attempt === 0 ? 0 : 50);
  }
}
