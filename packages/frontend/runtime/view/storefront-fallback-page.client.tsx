import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import type { IPluginContextValue } from '@fromcode119/react';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { HomeClient } from '@/app/components/view/home-client.client';
import { ServerMarkupHandoff } from '@/app/components/view/server-markup-handoff.client';
import { ThemeSsrShell } from '@/app/components/view/theme-ssr-shell.client';
import type { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';
import { StorefrontPageView } from '@/runtime/view/storefront-page-view.client';

/**
 * The fallback path's page: TODAY's client components, unchanged — `HomeClient` for the home route,
 * `DynamicContentClient` for a slug — holding the server markup through `ServerMarkupHandoff` until the
 * live tree has painted. Used whenever the hydrator decides the server tree cannot be adopted in place
 * (no markup, a recipe page, an editor session, a missing registration, a hydration error). Every page
 * keeps working on this path even if hydration misfires; the console says which path was taken.
 *
 * A 404 document takes its OWN branch, because it has no content by design. Routing it to
 * `DynamicContentClient` — which is what happened before this branch existed — renders that component's
 * empty-content body: an `<h1>` whose title falls back to the literal "Untitled", wrapped in the site's
 * real header, nav and footer. The visitor gets a page that looks published at a URL that does not
 * exist, and the server's correct 404 (the theme's own override chain, already on screen) is replaced
 * by it. Status stays 404 throughout, so only the body was ever wrong — and the body is what a person
 * reads.
 */
export class StorefrontFallbackPage extends Reactor {
  static contextType = PluginContextRegistry.Context;
  declare context: IPluginContextValue | null;

  @prop declare config: FrontendRuntimeConfig;

  /** The markup as served — what the handoff overlays until the live tree is ready. */
  @prop declare serverHtml: string;

  private get themeLayouts(): Record<string, ComponentType<any>> | undefined {
    return this.context?.themeLayouts as Record<string, ComponentType<any>> | undefined;
  }

  /**
   * True until the theme layout the server used is registered in the browser. Same decision
   * `DynamicContentClient` makes: swapping before it lands paints the passthrough layout — the page
   * without its header, nav or footer — and then swaps again when the theme arrives.
   */
  private get serverMarkupStillNeeded(): boolean {
    const themeLayouts = this.themeLayouts;
    const { config } = this;
    return !themeLayouts?.[config.resolvedLayoutName] && !themeLayouts?.[config.declaredDefaultLayout];
  }

  /**
   * The same tree the hydrate path would have adopted: the theme layout around the 404 override chain
   * (`framework.page.404` → `frontend.page.404` → `NotFoundBody`). Rendering it fresh is safe here —
   * the fallback mounts a NEW root, so nothing is being adopted and a markup mismatch cannot recur.
   */
  private renderNotFound(): ReactNode {
    const { serverHtml } = this;
    if (serverHtml && this.serverMarkupStillNeeded) return <ThemeSsrShell html={serverHtml} />;
    const tree = <StorefrontPageView config={this.config} />;
    return serverHtml ? <ServerMarkupHandoff html={serverHtml}>{tree}</ServerMarkupHandoff> : tree;
  }

  render(): ReactNode {
    const { config, serverHtml } = this;
    if (config.pageKind.isNotFound) {
      return this.renderNotFound();
    }
    if (config.pageKind === StorefrontPageKind.HOME) {
      return (
        <HomeClient
          initialContent={config.content}
          forcedLayout={config.layoutName || null}
          ssrHtml={serverHtml}
          ssrRendersContentSlot={config.ssrRendersContentSlot}
        />
      );
    }
    return <DynamicContentClient content={config.content} ssrHtml={serverHtml} ssrRendersContentSlot={config.ssrRendersContentSlot} />;
  }
}
