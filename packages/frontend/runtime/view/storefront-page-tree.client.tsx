import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react/slot';
import { NotFoundBody } from '@fromcode119/react/view/not-found-body';
import { Override } from '@fromcode119/react/view/override.client';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';

/**
 * The browser twin of `lib/ssr/theme-ssr-content-tree.ts` — the page BODY a theme layout is rendered
 * around, element for element.
 *
 * `ThemeSsrContentTree.build` constructs this tree with the runtime React so the theme's server bundle
 * can render it; this class renders the SAME tree in the browser so `hydrateRoot` can adopt the server
 * markup in place. Same wrapper div, same `frontend.content.display` / `frontend.content.footer` slots,
 * same string-content fallback, same empty box for a `recipe` page. The shared decisions
 * (`ContentRenderingUtils`, `StorefrontContentContract`) are imported, so only the element shape is restated here — the parity test
 * (`storefront-page-tree-parity.test.ts`) renders both through `react-dom/server` and diffs the HTML,
 * which is what keeps them in step.
 */
export class StorefrontPageTree extends PureReactor {
  @prop declare content: unknown;

  @prop declare className: string;

  @prop declare style: Record<string, string> | null;

  /** Set for a 404 document: the override chain around `NotFoundBody` instead of the content slots. */
  @prop declare notFoundPath?: string;

  private get entry(): Record<string, unknown> | null {
    return (this.content as Record<string, unknown> | null) ?? null;
  }

  render(): ReactNode {
    const entry = this.entry;
    const style = this.style ?? undefined;
    if (this.notFoundPath !== undefined) return <div className={this.className} style={style}>{this.renderNotFound(this.notFoundPath)}</div>;
    if (entry?.recipe) return <div className={this.className} style={style} />;

    const renderable = ContentRenderingUtils.buildRenderableContent(entry);
    const isStringContent = !renderable || typeof renderable === 'string';

    return (
      <div className={this.className} style={style}>
        <Slot key="display" name={StorefrontContentContract.DISPLAY_SLOT} props={{ content: renderable, entry }} />
        {isStringContent ? this.renderProse(entry, String(renderable || '')) : null}
        <Slot key="footer" name={StorefrontContentContract.FOOTER_SLOT} props={{ content: entry }} />
      </div>
    );
  }

  /** `framework.page.404` → `frontend.page.404` → `NotFoundBody`, exactly as `ThemeSsrContentTree.buildNotFound`. */
  private renderNotFound(path: string): ReactNode {
    const props = { path };
    const [framework, theme] = StorefrontContentContract.NOT_FOUND_OVERRIDES;
    return <Override key="not-found" name={framework} props={props} fallback={<Override name={theme} props={props} fallback={<NotFoundBody />} />} />;
  }

  /**
   * The stored-HTML fallback body, for pages whose content is a string rather than blocks. The HTML is
   * the page's own stored content, rendered raw exactly as the server renders it — the existing trust
   * decision restated, not a new one.
   */
  private renderProse(entry: Record<string, unknown> | null, html: string): ReactNode {
    return (
      <div key="prose" className={StorefrontContentContract.PROSE_CLASS}>
        <h1 className={StorefrontContentContract.TITLE_CLASS}>{ContentRenderingUtils.resolveDisplayTitle(entry)}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }
}
