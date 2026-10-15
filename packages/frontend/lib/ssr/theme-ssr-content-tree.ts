import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * The page BODY a theme layout is rendered around, built with the runtime React.
 *
 * This mirrors what `DynamicContentClient` / `HomeClient` render inside the layout — the same wrapper
 * div, the same `frontend.content.display` / `frontend.content.footer` slots, the same string-content
 * fallback. Slot names and prose classes come from `StorefrontContentContract`, shared with the browser
 * twin (`StorefrontPageTree`). It has to be a second construction rather than the client component itself: those live in
 * Next's module graph and use Next's React, while the theme and plugin bundles use the runtime copy, and
 * mixing the two is the dead-dispatcher crash `ThemeSsrRuntime` exists to prevent. The shared decisions
 * (`ContentRenderingUtils`) ARE imported, so only the element shape is restated — keep them in step.
 *
 * A page with a `recipe` renders through `DefaultPageDesignRenderer` in the browser, which resolves its
 * component from the default-design registry the plugin bundles fill. The caller resolves the same
 * registration on the server (`recipeComponent`) and it renders here with the same props and boundary;
 * with none resolved the page gets the empty (height-reserved) box and fills in after mount. A recipe
 * page is never hydrated in place (`StorefrontHydrator` hands it over with `ServerMarkupHandoff`), so
 * the browser twin keeps its empty box without a parity cost.
 */
export class ThemeSsrContentTree {
  static build(args: {
    runtime: ThemeSsrRuntime;
    content: unknown;
    className: string;
    style: Record<string, string> | null;
    /** A 404 document: the override chain around `NotFoundBody` instead of the content slots. */
    notFoundPath?: string;
    /** The document's locale, so the server's 404 body speaks the language the browser will. */
    locale?: string;
    /** The content transformers this render's bundles registered (`ThemeServerRegistry.contentTransform`). */
    transform: (content: unknown, currentContent: unknown) => unknown;
    /** The component a `recipe` page's default design resolved to on the server, when one did. */
    recipeComponent?: unknown;
  }): unknown {
    const { runtime, content, className, style, notFoundPath, locale, transform, recipeComponent } = args;
    const { createElement } = runtime.react;
    const wrapper = { className, style: style ?? undefined };
    const entry = content as Record<string, unknown> | null;

    if (notFoundPath !== undefined) return createElement('div', wrapper, ThemeSsrContentTree.buildNotFound(runtime, notFoundPath, locale));
    if (entry?.recipe) {
      if (!recipeComponent) return createElement('div', wrapper);
      return createElement(
        'div',
        wrapper,
        createElement(
          runtime.frameworkReact.PluginMountErrorBoundary,
          { key: 'design', slotName: 'default-page-design', componentName: String(entry.recipe) },
          createElement(recipeComponent, { content: ContentRenderingUtils.buildRenderableContent(entry, transform), entry }),
        ),
        createElement(runtime.frameworkReact.Slot, { key: 'footer', name: StorefrontContentContract.FOOTER_SLOT, props: { content: entry } }),
      );
    }

    const Slot = runtime.frameworkReact.Slot;
    const renderable = ContentRenderingUtils.buildRenderableContent(entry, transform);
    const isStringContent = !renderable || typeof renderable === 'string';

    return createElement(
      'div',
      wrapper,
      createElement(Slot, { key: 'display', name: StorefrontContentContract.DISPLAY_SLOT, props: { content: renderable, entry } }),
      isStringContent ? ThemeSsrContentTree.buildProse(runtime, entry, String(renderable || '')) : null,
      createElement(Slot, { key: 'footer', name: StorefrontContentContract.FOOTER_SLOT, props: { content: entry } }),
    );
  }

  /** `framework.page.404` → `frontend.page.404` → `NotFoundBody`, exactly as `StorefrontPageTree.renderNotFound`. */
  private static buildNotFound(runtime: ThemeSsrRuntime, path: string, locale?: string): unknown {
    const { createElement } = runtime.react;
    const { Override, NotFoundBody } = runtime.frameworkReact;
    const props = { path };
    const [framework, theme] = StorefrontContentContract.NOT_FOUND_OVERRIDES;
    return createElement(Override, { key: 'not-found', name: framework, props, fallback: createElement(Override, { name: theme, props, fallback: createElement(NotFoundBody, { locale }) }) });
  }

  /**
   * The stored-HTML fallback body, for pages whose content is a string rather than blocks. The HTML is
   * the page's own stored content, rendered raw by the client component in exactly the same way — this
   * is not a new trust decision, it is the existing one restated on the server.
   */
  private static buildProse(runtime: ThemeSsrRuntime, entry: Record<string, unknown> | null, html: string): unknown {
    const { createElement } = runtime.react;
    return createElement(
      'div',
      { key: 'prose', className: StorefrontContentContract.PROSE_CLASS },
      createElement('h1', { className: StorefrontContentContract.TITLE_CLASS }, ContentRenderingUtils.resolveDisplayTitle(entry)),
      createElement('div', { dangerouslySetInnerHTML: { __html: html } }),
    );
  }
}
