import React from 'react';
import { PageStyleContext } from './page-style-context';
import type { PageStyleContextValue } from './page-style-context.interfaces';

interface PageStyleProviderProps {
  page: { styleVariant?: string } | null | undefined;
  themeStyleVariants: Record<string, Record<string, unknown>> | undefined;
  children: React.ReactNode;
}

/**
 * Provides {@link PageStyleContext}. Hook-free class: the context value object is rebuilt only
 * when its inputs (styleVariant / styleConfig) change (instance memoization), preserving the
 * referential stability the previous useMemo gave so consumers don't re-render needlessly.
 */
export class PageStyleProvider extends React.Component<PageStyleProviderProps> {
  private memoVariant = '';
  private memoConfig: Record<string, unknown> | null = null;
  private memoValue: PageStyleContextValue = { styleVariant: 'default', styleConfig: null };

  render(): React.ReactNode {
    const styleVariant = String(this.props.page?.styleVariant || 'default').trim();
    const styleConfig = this.props.themeStyleVariants?.[styleVariant] ?? null;
    if (styleVariant !== this.memoVariant || styleConfig !== this.memoConfig) {
      this.memoVariant = styleVariant;
      this.memoConfig = styleConfig;
      this.memoValue = { styleVariant, styleConfig };
    }
    return <PageStyleContext.context.Provider value={this.memoValue}>{this.props.children}</PageStyleContext.context.Provider>;
  }
}
