import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * The page BODY a theme layout is rendered around, built with the runtime React.
 *
 * This mirrors what `DynamicContentClient` / `HomeClient` render inside the layout — the same wrapper
 * div, the same `frontend.content.display` / `frontend.content.footer` slots, the same string-content
 * fallback. It has to be a second construction rather than the client component itself: those live in
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
  }): unknown {
    const { runtime, content, className, style } = args;
    const { createElement } = runtime.react;
    const wrapper = { className, style: style ?? undefined };
    const entry = content as Record<string, unknown> | null;

    if (entry?.recipe) return createElement('div', wrapper);

    const Slot = runtime.frameworkReact.Slot;
    const renderable = ContentRenderingUtils.buildRenderableContent(entry);
    const isStringContent = !renderable || typeof renderable === 'string';

    return createElement(
      'div',
      wrapper,
      createElement(Slot, { key: 'display', name: 'frontend.content.display', props: { content: renderable, entry } }),
      isStringContent ? ThemeSsrContentTree.buildProse(runtime, entry, String(renderable || '')) : null,
      createElement(Slot, { key: 'footer', name: 'frontend.content.footer', props: { content: entry } }),
    );
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
      { key: 'prose', className: 'prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6' },
      createElement('h1', { className: 'text-4xl font-black mb-8' }, ContentRenderingUtils.resolveDisplayTitle(entry)),
      createElement('div', { dangerouslySetInnerHTML: { __html: html } }),
    );
  }
}
