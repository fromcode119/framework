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
 * it must stay self-contained — only its parameters and the DOM.
 *
 * The two halves share nothing on `window`: the inline script records what it held in an inert
 * `<script type="application/json">` element and stops when the runtime dispatches {@link RELEASE_EVENT}.
 */
export class EarlyInteractionBuffer {
  /** The inert JSON element in which the inline script records what it held, for the runtime to read. */
  static readonly STATE_ELEMENT_ID = 'fc-early-interactions';

  /** Dispatched on `document` by {@link release}; the inline script stops holding when it arrives. */
  static readonly RELEASE_EVENT = 'fc:early-interactions-release';

  /** Set on a control whose click is being held; removed when it is played back. */
  static readonly PENDING_ATTRIBUTE = 'data-fc-pending';

  /** How long playback waits for a fallback re-render to put the control back, in 50 ms steps. */
  private static readonly RETRY_LIMIT = 100;

  static bootstrap(stateElementId: string, pendingAttribute: string, releaseEvent: string): void {
    const controlSelector = 'button,[role="button"],input[type="submit"],input[type="button"],input[type="image"]';
    const held: Array<{ path: string; submit: boolean }> = [];
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
    const record = (): void => {
      let state = document.getElementById(stateElementId);
      if (!state) {
        state = document.createElement('script');
        state.setAttribute('type', 'application/json');
        state.id = stateElementId;
        (document.head || document.documentElement).appendChild(state);
      }
      state.textContent = JSON.stringify(held).replace(/</g, '\\u003c');
    };
    const hold = (element: Element, submit: boolean): void => {
      const path = pathOf(element);
      if (!held.some((entry) => entry.path === path)) held.push({ path, submit });
      element.setAttribute(pendingAttribute, '');
      element.setAttribute('aria-busy', 'true');
      record();
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
    const onRelease = (): void => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener(releaseEvent, onRelease);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener(releaseEvent, onRelease);
  }

  /** The IIFE for the inline `<script>`. */
  static inlineScript(): string {
    const args = [EarlyInteractionBuffer.STATE_ELEMENT_ID, EarlyInteractionBuffer.PENDING_ATTRIBUTE, EarlyInteractionBuffer.RELEASE_EVENT];
    return `(function ${EarlyInteractionBuffer.bootstrap.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')});`;
  }

  /**
   * Stop holding and play back what was held. Called once, right after the runtime mounts: React's
   * listeners are attached by then, and a click on a boundary still hydrating is one React replays.
   */
  static release(win: Window = window): void {
    const doc = win.document;
    doc.dispatchEvent(new Event(EarlyInteractionBuffer.RELEASE_EVENT));
    const state = doc.getElementById(EarlyInteractionBuffer.STATE_ELEMENT_ID);
    const held = EarlyInteractionBuffer.readHeld(state?.textContent || '');
    state?.remove();
    doc.querySelectorAll(`[${EarlyInteractionBuffer.PENDING_ATTRIBUTE}]`).forEach((element) => {
      element.removeAttribute(EarlyInteractionBuffer.PENDING_ATTRIBUTE);
      element.removeAttribute('aria-busy');
    });
    for (const entry of held) EarlyInteractionBuffer.playBack(win, entry, 0);
  }

  private static readHeld(json: string): Array<{ path: string; submit: boolean }> {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.map((entry) => ({ path: String(entry?.path || ''), submit: entry?.submit === true })).filter((entry) => entry.path) : [];
    } catch {
      return [];
    }
  }

  private static playBack(win: Window, entry: { path: string; submit: boolean }, attempt: number): void {
    win.setTimeout(() => {
      const element = win.document.querySelector(entry.path);
      if (!element) {
        if (attempt < EarlyInteractionBuffer.RETRY_LIMIT) EarlyInteractionBuffer.playBack(win, entry, attempt + 1);
        return;
      }
      if (entry.submit && element.tagName === 'FORM') (element as HTMLFormElement).requestSubmit();
      else (element as HTMLElement).click();
    }, attempt === 0 ? 0 : 50);
  }
}
