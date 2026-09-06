import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import type { IPluginContextValue } from '@fromcode119/react';
import { PassthroughLayout } from '@/components/view/passthrough-layout.client';
import type { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontPageTree } from '@/runtime/view/storefront-page-tree.client';

/**
 * The page as the SERVER rendered it: the theme layout the server chose, around `StorefrontPageTree`.
 * This is the tree `hydrateRoot` adopts — it mirrors `ThemeServerRenderer.renderOrThrow` (layout by the
 * content's own name, else the theme's declared default; the raw content as `page`; the body inside),
 * not the swap-era client components, which decide differently on purpose.
 *
 * `PassthroughLayout` is only reachable when the hydrator's decision was wrong about registration; it
 * keeps the tree renderable rather than throwing, and the resulting mismatch takes the fallback path.
 */
export class StorefrontPageView extends Reactor {
  static contextType = PluginContextRegistry.Context;
  declare context: IPluginContextValue | null;

  @prop declare config: FrontendRuntimeConfig;

  private get layout(): ComponentType<any> {
    const themeLayouts = (this.context?.themeLayouts || {}) as Record<string, ComponentType<any>>;
    const { config } = this;
    return themeLayouts[config.resolvedLayoutName] || themeLayouts[config.declaredDefaultLayout] || PassthroughLayout;
  }

  render(): ReactNode {
    const { config } = this;
    const Layout = this.layout;
    return (
      <Layout page={config.content}>
        <StorefrontPageTree content={config.content} className={config.pageKind.contentClassName} style={config.pageKind.contentStyle} notFoundPath={config.pageKind.isNotFound ? config.notFoundPath : undefined} />
      </Layout>
    );
  }
}
