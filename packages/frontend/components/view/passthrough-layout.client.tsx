import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';

/**
 * Identity-stable no-op layout used while `themeLayouts` has no match (e.g. before the active
 * theme's bundle registers its layouts). Previously this fallback was an inline arrow component
 * created on EVERY render of DynamicContentClient/HomeClient — each render produced a new
 * component type, so React unmounted and remounted the whole pre-theme content subtree on every
 * context update, causing layout churn. A single module-level class keeps the tree stable.
 */
export class PassthroughLayout extends Reactor {
  @prop declare children?: ReactNode;

  render(): ReactNode {
    return <>{this.children}</>;
  }
}
