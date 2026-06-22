"use client";

import React from 'react';
import type { MarketplaceGridStateProps } from './marketplace-grid-states.interfaces';

export class MarketplaceLoadingGrid extends React.Component<MarketplaceGridStateProps> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`h-64 rounded-xl animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border border-slate-100 shadow-sm'}`} />
        ))}
      </>
    );
  }
}
