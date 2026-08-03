import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { PageStyleContext } from '@react/page-style-context';
import type { IPageStyleContextValue } from '@react/interfaces/page-style-context-value.interface';

/**
 * Provides {@link PageStyleContext}. Hook-free class: the context value object is rebuilt only
 * when its inputs (styleVariant / styleConfig) change (instance memoization), preserving the
 * referential stability the previous useMemo gave so consumers don't re-render needlessly.
 */
export class PageStyleProvider extends Reactor {
  @prop declare page: { styleVariant?: string } | null | undefined;
  @prop declare themeStyleVariants: Record<string, Record<string, unknown>> | undefined;
  @prop declare children: ReactNode;

  private memoVariant = '';
  private memoConfig: Record<string, unknown> | null = null;
  private memoValue: IPageStyleContextValue = { styleVariant: 'default', styleConfig: null };

  render(): ReactNode {
    const styleVariant = String(this.page?.styleVariant || 'default').trim();
    const styleConfig = this.themeStyleVariants?.[styleVariant] ?? null;
    if (styleVariant !== this.memoVariant || styleConfig !== this.memoConfig) {
      this.memoVariant = styleVariant;
      this.memoConfig = styleConfig;
      this.memoValue = { styleVariant, styleConfig };
    }
    return <PageStyleContext.context.Provider value={this.memoValue}>{this.children}</PageStyleContext.context.Provider>;
  }
}
