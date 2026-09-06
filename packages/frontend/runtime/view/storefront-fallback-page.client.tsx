import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { HomeClient } from '@/app/components/view/home-client.client';
import type { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';

/**
 * The fallback path's page: TODAY's client components, unchanged — `HomeClient` for the home route,
 * `DynamicContentClient` for a slug — holding the server markup through `ServerMarkupHandoff` until the
 * live tree has painted. Used whenever the hydrator decides the server tree cannot be adopted in place
 * (no markup, a recipe page, an editor session, a missing registration, a hydration error). Every page
 * keeps working on this path even if hydration misfires; the console says which path was taken.
 */
export class StorefrontFallbackPage extends Reactor {
  @prop declare config: FrontendRuntimeConfig;

  /** The markup as served — what the handoff overlays until the live tree is ready. */
  @prop declare serverHtml: string;

  render(): ReactNode {
    const { config, serverHtml } = this;
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
