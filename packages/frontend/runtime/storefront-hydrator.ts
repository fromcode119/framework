import type { Root } from 'react-dom/client';
import { EditorSessionParams } from '@fromcode119/core/client';
import { StorefrontDocumentContract } from '@/lib/document/storefront-document-contract';
import { ReactPrimitives, bound } from '@fromcode119/reactor';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';
import { StorefrontHydrationReason } from '@/runtime/storefront-hydration-reason';
import type { IStorefrontHydratorArgs } from '@/runtime/interfaces/storefront-hydrator-args.interface';

/**
 * Decides HOW the runtime takes over the server-rendered page, then does it.
 *
 * `hydrateRoot` when the first client render can be the server tree: React adopts the markup in place,
 * no second render, no hidden live tree, no overlay. `createRoot` + today's `ServerMarkupHandoff`
 * (render hidden, reveal when settled) whenever parity cannot be guaranteed — no markup, a `recipe`
 * page, an editor session, a layout or content slot the loaded bundles did not register. And when
 * hydration itself reports a mismatch (`onRecoverableError`), the page is re-mounted ONCE on the
 * fallback path from the markup it started with: it keeps working, the console says why, and a second
 * error never starts a second fallback.
 *
 * An editor session is whatever `EditorSessionParams` says it is — the framework's `preview` plus the
 * parameters each plugin registered for its own editor when its bundle evaluated (the eager bundles have
 * evaluated by the time `decide` runs). The hydrator keeps no list: a theme's layout shell mounts a
 * client-only Slot on those sessions, so the client tree is not the server tree.
 *
 * The decision (`decide`) is a pure function of the document and the registrations, so it is tested as
 * a table; `mount` is the only side effect.
 */
export class StorefrontHydrator {
  static readonly ROOT_ID = StorefrontDocumentContract.ROOT_ID;

  private static readonly LOG_PREFIX = '[frontend] hydration';

  private root: Root | null = null;

  private fellBack = false;

  /** The markup as served — what the fallback path hands over from, even after a failed hydration. */
  private readonly serverHtml: string;

  constructor(private readonly args: IStorefrontHydratorArgs) {
    this.serverHtml = String(args.host?.innerHTML || '');
  }

  /** The decision table. */
  static decide(args: Pick<IStorefrontHydratorArgs, 'host' | 'config' | 'registrations' | 'search'>): StorefrontHydrationReason {
    const { host, config, registrations } = args;
    if (!host) return StorefrontHydrationReason.NO_ROOT;
    if (!String(host.innerHTML || '').trim()) return StorefrontHydrationReason.NO_MARKUP;
    // A 404 document has no content by design: its body is the override chain around `NotFoundBody`.
    if (!config.content && !config.pageKind.isNotFound) return StorefrontHydrationReason.NO_CONTENT;
    if (config.hasRecipe) return StorefrontHydrationReason.RECIPE;
    if (EditorSessionParams.isEditorSession(args.search ?? window.location.search)) return StorefrontHydrationReason.EDITOR_SESSION;
    if (!StorefrontHydrator.layoutRegistered(config.resolvedLayoutName, config.declaredDefaultLayout, registrations.themeLayouts)) {
      return StorefrontHydrationReason.LAYOUT_NOT_REGISTERED;
    }
    if (config.ssrRendersContentSlot && !registrations.slots[StorefrontContentContract.DISPLAY_SLOT]?.length) {
      return StorefrontHydrationReason.CONTENT_SLOT_MISSING;
    }
    return StorefrontHydrationReason.READY;
  }

  /** The same resolution `ThemeServerRenderer` made: the named layout, else the theme's declared default. */
  private static layoutRegistered(layoutName: string, declaredDefault: string, themeLayouts: Record<string, unknown>): boolean {
    return Boolean((layoutName && themeLayouts[layoutName]) || (declaredDefault && themeLayouts[declaredDefault]));
  }

  /** Decide and mount. Returns the decision it acted on. */
  mount(): StorefrontHydrationReason {
    const reason = StorefrontHydrator.decide(this.args);
    if (reason.hydrates) this.hydrate();
    else this.fallback(reason);
    return reason;
  }

  private hydrate(): void {
    const host = this.args.host as HTMLElement;
    console.info(`${StorefrontHydrator.LOG_PREFIX} mode=hydrate`);
    this.root = ReactPrimitives.hydrateRoot(host, this.args.hydrateTree, { onRecoverableError: this.onRecoverableError });
  }

  /**
   * React recovered from a mismatch by re-rendering client-side — which means the markup on screen is
   * now the CLIENT's, not the server's, and the design may have shifted. Take the fallback path once,
   * from the markup as served. Deferred a tick: React reports this during its commit, and a root must
   * not be unmounted from inside another root's commit.
   */
  @bound private onRecoverableError(error: unknown): void {
    if (this.fellBack) {
      console.warn(`${StorefrontHydrator.LOG_PREFIX} recoverable error after fallback (ignored):`, error);
      return;
    }
    this.fellBack = true;
    console.warn(`${StorefrontHydrator.LOG_PREFIX} fallback: ${StorefrontHydrationReason.RECOVERABLE_ERROR.value}`, error);
    window.setTimeout(this.fallbackAfterHydration, 0);
  }

  @bound private fallbackAfterHydration(): void {
    const host = this.args.host as HTMLElement;
    this.root?.unmount();
    this.root = null;
    host.innerHTML = this.serverHtml;
    this.renderFallback(host);
  }

  private fallback(reason: StorefrontHydrationReason): void {
    this.fellBack = true;
    console.warn(`${StorefrontHydrator.LOG_PREFIX} fallback: ${reason.value}`);
    if (!this.args.host) return;
    this.renderFallback(this.args.host);
  }

  private renderFallback(host: HTMLElement): void {
    this.root = ReactPrimitives.createRoot(host);
    this.root.render(this.args.fallbackTree(this.serverHtml));
  }

  /** True once the page has been handed to the fallback path (a decision, or a recovered error). */
  get hasFallenBack(): boolean {
    return this.fellBack;
  }
}
