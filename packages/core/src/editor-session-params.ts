import { StringUtils } from '@core/utils/string-utils';

/**
 * The query parameters that mark a page load as an EDITOR SESSION — a request on which something other
 * than the published page is about to mount: a visual editor's app shell, an operator's draft preview.
 * A theme layout shell decides from this whether to route the page through its editor Slot; the islands
 * runtime decides from it whether the server tree can be hydrated in place (an editor session mounts a
 * client-only Slot, so the client tree is NOT the server tree and the page takes the fallback path).
 *
 * ONE owner. The framework's own marker is `preview` — `CollectionService` builds the admin's "Preview"
 * links with it and `QueryParamUtils.isPreviewMode` reads it. Every OTHER activation parameter belongs
 * to the plugin whose editor it activates, and that plugin registers it here when its storefront bundle
 * evaluates (`EditorSessionParams.register('<slug>', ['edit', …])` as a static initialiser — the same
 * shape as `PublicAssetUrlUtils.registerImageOptimizer`). The framework never names a plugin's
 * parameter, and no theme or framework site keeps a list of its own: they ask `isEditorSession()`.
 *
 * A parameter counts when it is PRESENT WITH A NON-EMPTY VALUE (`?edit=1`, never `?edit=`), which is the
 * test the cms visual editor and the theme layout shells have always applied.
 */
export class EditorSessionParams {
  /** The framework's own marker: an operator's preview of unpublished content. */
  static readonly PREVIEW = 'preview';

  /** Plugin-registered parameter → the slug that registered it. Insertion-ordered. */
  private static readonly registered = new Map<string, string>();

  /**
   * A plugin declares the parameters that activate ITS editor. Idempotent — the same plugin registering
   * the same name twice is one entry; a second plugin claiming a name already taken keeps the first
   * owner and says so once. Returns `true` so it can sit in a static field initialiser.
   */
  static register(ownerSlug: string, names: readonly string[]): boolean {
    const owner = String(ownerSlug || '').trim();
    for (const name of StringUtils.normalizeSlugList(names)) {
      if (!name || name === EditorSessionParams.PREVIEW) continue;
      const current = EditorSessionParams.registered.get(name);
      if (current && current !== owner) {
        console.warn(`[EditorSessionParams] "${name}" is already registered by "${current}"; "${owner}" keeps it as is`);
        continue;
      }
      EditorSessionParams.registered.set(name, owner);
    }
    return true;
  }

  /** Every parameter that marks an editor session: the framework's `preview` first, then the registered ones. */
  static names(): readonly string[] {
    return [EditorSessionParams.PREVIEW, ...EditorSessionParams.registered.keys()];
  }

  /** The slug that registered `name`; `'framework'` for `preview`; `null` for a name nobody owns. */
  static ownerOf(name: string): string | null {
    const key = String(name || '').trim();
    if (key === EditorSessionParams.PREVIEW) return 'framework';
    return EditorSessionParams.registered.get(key) ?? null;
  }

  /** True when `search` carries any editor-session parameter with a non-empty value. */
  static isEditorSession(search: string | URLSearchParams | null | undefined): boolean {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ''));
    return EditorSessionParams.names().some((name) => String(params.get(name) || '').trim() !== '');
  }
}
