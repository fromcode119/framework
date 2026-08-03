import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';
import { FrontendRuntimeScheduler } from '@/app/frontend-runtime-scheduler';

/**
 * Keeps the plugin runtime out of the route's initial render.
 *
 * Server-side and on the client's FIRST render this is a pass-through: it renders `children` with no
 * provider above them, which is exactly what the server does, so hydration matches. With no plugin
 * context present the content components render the server markup — the page is already complete.
 *
 * After the paint, `StorefrontRuntimeTree` is imported and the children re-render inside it, at which
 * point the theme boots and everything becomes interactive. Nothing is skipped; the runtime simply stops
 * being part of what has to arrive before the page can be looked at.
 */
export class StorefrontRuntimeGate extends Reactor {
  @prop declare children: ReactNode;

  @state private tree: ComponentType<{ children: ReactNode }> | null = null;

  componentDidMount(): void {
    FrontendRuntimeScheduler.run(() => {
      void import('@/app/components/view/storefront-runtime-tree.client')
        .then((module) => { this.tree = module.StorefrontRuntimeTree as never; })
        .catch((error) => console.error('[frontend] Plugin runtime failed to load:', error));
    });
  }

  render(): ReactNode {
    const Tree = this.tree;
    return Tree ? <Tree>{this.children}</Tree> : <>{this.children}</>;
  }
}
