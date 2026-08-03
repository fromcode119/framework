import type { ComponentType } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react/slot';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import type { IPluginContextValue } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { DefaultPageDesignRenderer } from '@/app/components/view/default-page-design-renderer.client';
import { PassthroughLayout } from '@/components/view/passthrough-layout.client';
import { ThemeSsrShell } from '@/app/components/view/theme-ssr-shell.client';
import { ServerMarkupHandoff } from '@/app/components/view/server-markup-handoff.client';

export class DynamicContentClient extends Reactor {
  static contextType = PluginContextRegistry.Context;
  declare context: IPluginContextValue | null;

  @prop declare content: any;

  /** The theme layout, already rendered to HTML server-side. Empty when theme SSR is unavailable. */
  @prop declare ssrHtml: string;

  /** The server render used a plugin's content slot, so the swap must wait for that plugin too. */
  @prop declare ssrRendersContentSlot: boolean;

  private get themeLayouts(): Record<string, ComponentType<any>> | undefined {
    return this.context?.themeLayouts as Record<string, ComponentType<any>> | undefined;
  }

  /**
   * True until the browser has everything the server render used.
   *
   * The theme registers its layouts first and plugin bundles land after it, so swapping on the layout
   * alone would blank the page body for a beat — a scored layout shift. `ssrRendersContentSlot` says
   * whether the server body actually came from a plugin slot; when it did, that slot has to be present
   * too. A page the server rendered WITHOUT it (no blocks) swaps as soon as the layout is there.
   */
  private get serverMarkupStillNeeded(): boolean {
    const themeLayouts = this.themeLayouts;
    const selectedLayoutName = ResolvedContentShape.resolveLayoutName(this.normalizedContent) || 'DefaultLayout';
    if (!themeLayouts?.[selectedLayoutName] && !themeLayouts?.DefaultLayout) return true;
    if (!this.ssrRendersContentSlot) return false;
    return !this.context?.slots?.[DynamicContentClient.CONTENT_SLOT]?.length;
  }

  private static readonly CONTENT_SLOT = 'frontend.content.display';

  private get normalizedContent() {
    return ResolvedContentShape.normalize((this.content as Record<string, unknown> | null) || null);
  }

  private get layoutComponent(): ComponentType<any> {
    const themeLayouts = this.themeLayouts;
    const selectedLayoutName = ResolvedContentShape.resolveLayoutName(this.normalizedContent) || 'DefaultLayout';
    return (
      themeLayouts?.[selectedLayoutName] ||
      themeLayouts?.DefaultLayout ||
      PassthroughLayout
    );
  }

  render() {
    // The server-rendered page stands in until the browser can reproduce it. The client's FIRST render
    // takes this branch too (registration lands several round-trips later), so the markup React
    // hydrates is byte-identical to what the server sent.
    if (this.ssrHtml && this.serverMarkupStillNeeded) {
      return <ThemeSsrShell html={this.ssrHtml} />;
    }
    // Mountable is not the same as showable: the live components mount empty and fetch. The handoff
    // keeps the server markup on screen until the live tree has actually painted, so the page never
    // blanks between the two.
    if (this.ssrHtml) {
      return <ServerMarkupHandoff html={this.ssrHtml}>{this.renderLive()}</ServerMarkupHandoff>;
    }
    return this.renderLive();
  }

  private renderLive() {
    const normalizedContent = this.normalizedContent;
    const LayoutComponent = this.layoutComponent;
    const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, normalizedContent);
    const renderableContent = shouldBypassDefaultContent
      ? null
      : ContentRenderingUtils.buildRenderableContent(normalizedContent);
    const hasDefaultPageDesign = Boolean(normalizedContent?.recipe);

    return (
    <LayoutComponent page={normalizedContent}>
      {!shouldBypassDefaultContent ? (
        <div className="w-full" style={{ minHeight: '100svh' }}>
          {hasDefaultPageDesign ? (
            <DefaultPageDesignRenderer content={renderableContent} entry={normalizedContent} />
          ) : (
            <Slot name="frontend.content.display" props={{ content: renderableContent, entry: normalizedContent }} />
          )}

          {(!hasDefaultPageDesign && (!renderableContent || typeof renderableContent === 'string')) && (
            <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
              <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(normalizedContent)}</h1>
              <div dangerouslySetInnerHTML={{ __html: renderableContent || '' }} />
            </div>
          )}

          <Slot name="frontend.content.footer" props={{ content: normalizedContent }} />
        </div>
      ) : null}
    </LayoutComponent>
  );
  }
}
