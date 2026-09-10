import { Enum } from '@fromcode119/react-class-components';

/**
 * Why the runtime hydrated the server tree in place — or why it took the fallback path
 * (`createRoot` + `ServerMarkupHandoff`, today's render-and-swap). Logged on every boot, so a page
 * that silently stopped hydrating is visible in the console and the frontend log (plan Task 6 watches
 * for `[frontend] hydration fallback`).
 */
export class StorefrontHydrationReason extends Enum {
  /** The server tree is registered client-side and can be adopted in place. */
  static readonly READY = new StorefrontHydrationReason('ready', true);

  /** No `#fc-root` in the document — nothing to mount into. */
  static readonly NO_ROOT = new StorefrontHydrationReason('no-root', false);

  /** `#fc-root` is empty: the server rendered no theme markup, so there is nothing to adopt. */
  static readonly NO_MARKUP = new StorefrontHydrationReason('no-markup', false);

  /** No resolved content — the empty-site hero is a client-only tree. */
  static readonly NO_CONTENT = new StorefrontHydrationReason('no-content', false);

  /** A `recipe` page: the server rendered an empty box the client fills (`ThemeSsrContentTree`). */
  static readonly RECIPE = new StorefrontHydrationReason('recipe', false);

  /** An editor session (`EditorSessionParams`): the layout shell mounts an extra client-only Slot. */
  static readonly EDITOR_SESSION = new StorefrontHydrationReason('editor-session', false);

  /** The layout the server rendered with is not registered by the theme bundle that loaded. */
  static readonly LAYOUT_NOT_REGISTERED = new StorefrontHydrationReason('layout-not-registered', false);

  /** The server body came from a plugin's content slot that no loaded bundle registered. */
  static readonly CONTENT_SLOT_MISSING = new StorefrontHydrationReason('content-slot-missing', false);

  /** React reported a hydration mismatch (`onRecoverableError`); the page was re-rendered on the fallback path. */
  static readonly RECOVERABLE_ERROR = new StorefrontHydrationReason('recoverable-error', false);

  private constructor(value: string, readonly hydrates: boolean) {
    super(value);
  }

  /** The word the console line carries: `hydrate` or `fallback`. */
  get mode(): string {
    return this.hydrates ? 'hydrate' : 'fallback';
  }
}
