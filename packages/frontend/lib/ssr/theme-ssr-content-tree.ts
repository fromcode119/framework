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
 * A page with a `recipe` renders through `DefaultPageDesignRenderer`, which resolves its component from
 * a core singleton that only the Next bundle populates. There is no server equivalent, so those pages
 * get the empty (height-reserved) box and fill in on hydration exactly as before.
 */
export class ThemeSsrContentTree {
  static build(args: {
    runtime: ThemeSsrRuntime;
    content: unknown;
    className: string;
    style: Record<string, string> | null;
    /** A 404 document: the override chain around `NotFoundBody` instead of the content slots. */
    notFoundPath?: string;
  }): unknown {
    const { runtime, content, className, style, notFoundPath } = args;
    const { createElement } = runtime.react;
    const wrapper = { className, style: style ?? undefined };
    const entry = content as Record<string, unknown> | null;

    if (notFoundPath !== undefined) return createElement('div', wrapper, ThemeSsrContentTree.buildNotFound(runtime, notFoundPath));
    if (entry?.recipe) return createElement('div', wrapper);

    const Slot = runtime.frameworkReact.Slot;
    const renderable = ContentRenderingUtils.buildRenderableContent(entry);
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
  private static buildNotFound(runtime: ThemeSsrRuntime, path: string): unknown {
    const { createElement } = runtime.react;
    const { Override, NotFoundBody } = runtime.frameworkReact;
    const props = { path };
    const [framework, theme] = StorefrontContentContract.NOT_FOUND_OVERRIDES;
    return createElement(Override, { key: 'not-found', name: framework, props, fallback: createElement(Override, { name: theme, props, fallback: createElement(NotFoundBody, {}) }) });
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
