import { Reactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react/slot';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import type { IPluginContextValue } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { DefaultPageDesignRenderer } from '@/app/components/view/default-page-design-renderer.client';
import { StarterHero } from '@/app/components/view/starter-hero.client';
import { PassthroughLayout } from '@/components/view/passthrough-layout.client';
import { ThemeSsrShell } from '@/app/components/view/theme-ssr-shell.client';
import { ServerMarkupHandoff } from '@/app/components/view/server-markup-handoff.client';

export class HomeClient extends Reactor {

  /**
   * The layout name the ACTIVE THEME declares for pages that name none (theme.json `defaultLayout`).
   * Empty when the theme declares nothing — the framework never invents a layout name, because a
   * guessed one silently renders a different design than the admin says is selected.
   */
  private get declaredDefaultLayout(): string {
    return String((this.context?.activeTheme as Record<string, unknown> | null)?.defaultLayout || '');
  }
  /** Product name used when a page has no title of its own. */
  private static readonly FRAMEWORK_TITLE = 'Atlantis';

  private renderContent(content: any) {
    const rawContent = ContentRenderingUtils.buildRenderableContent(content);
    const hasDefaultPageDesign = Boolean(content?.recipe);
    const hasStringContent = typeof rawContent === 'string' && rawContent.trim().length > 0;
    const hasStructuredContent = Array.isArray(rawContent)
      ? rawContent.length > 0
      : !!(rawContent && typeof rawContent === 'object' && Object.keys(rawContent).length > 0);

    if (!hasStringContent && !hasStructuredContent) {
      return <StarterHero />;
    }

    return (
      <div className="w-full">
        {hasDefaultPageDesign ? (
          <DefaultPageDesignRenderer content={rawContent} entry={content} />
        ) : (
          <Slot name="frontend.content.display" props={{ content: rawContent, entry: content }} />
        )}

        {(!hasDefaultPageDesign && typeof rawContent === 'string') && (
          <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
            <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(content, HomeClient.FRAMEWORK_TITLE)}</h1>
            <div dangerouslySetInnerHTML={{ __html: rawContent || '' }} />
          </div>
        )}

        <Slot name="frontend.content.footer" props={{ content }} />
      </div>
    );
  }

  static contextType = PluginContextRegistry.Context;
  declare context: IPluginContextValue | null;

  @prop declare initialContent: any | null;
  @prop declare forcedLayout: string | null;

  /** The theme layout, already rendered to HTML server-side. Empty when theme SSR is unavailable. */
  @prop declare ssrHtml: string;

  /** The server render used a plugin's content slot, so the swap must wait for that plugin too. */
  @prop declare ssrRendersContentSlot: boolean;

  private static readonly CONTENT_SLOT = 'frontend.content.display';

  /** See the same getter on `DynamicContentClient` — swapping early blanks the body for a beat. */
  private get serverMarkupStillNeeded(): boolean {
    if (!this.context?.themeLayouts?.[this.declaredDefaultLayout]) return true;
    if (!this.ssrRendersContentSlot) return false;
    return !this.context?.slots?.[HomeClient.CONTENT_SLOT]?.length;
  }

  render() {
    // The server-rendered page stands in until the browser can reproduce it. The client's FIRST render
    // takes this branch too (registration lands several round-trips later), so the markup React
    // hydrates is byte-identical to what the server sent.
    if (this.ssrHtml && this.serverMarkupStillNeeded) {
      return <ThemeSsrShell html={this.ssrHtml} />;
    }
    // Mountable is not showable — see ServerMarkupHandoff.
    if (this.ssrHtml) {
      return <ServerMarkupHandoff html={this.ssrHtml}>{this.renderLive()}</ServerMarkupHandoff>;
    }
    return this.renderLive();
  }

  private renderLive() {
    // `this.context` is NULL until the plugin runtime arrives — the provider is code-split behind
    // `StorefrontRuntimeGate` now, so it is absent for the server render and the first client render.
    // Destructuring it directly threw and took the whole page to a 500.
    const themeLayouts = this.context?.themeLayouts;
    const normalizedContent = ResolvedContentShape.normalize((this.initialContent as Record<string, unknown> | null) || null);

    if (normalizedContent) {
      const selectedLayoutName = ResolvedContentShape.resolveLayoutName(normalizedContent) || this.declaredDefaultLayout;
      const LayoutComponent =
        themeLayouts?.[selectedLayoutName] ||
        themeLayouts?.[this.declaredDefaultLayout] ||
        PassthroughLayout;
      const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, normalizedContent);

      return (
        <LayoutComponent page={normalizedContent}>
          {!shouldBypassDefaultContent ? this.renderContent(normalizedContent) : null}
        </LayoutComponent>
      );
    }

    if (this.forcedLayout && themeLayouts?.[this.forcedLayout]) {
      const ForcedLayoutComponent = themeLayouts[this.forcedLayout];
      return <ForcedLayoutComponent />;
    }

    return <StarterHero />;
  }
}
