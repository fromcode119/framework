"use client";

import React from 'react';
import type { MarketplaceGridStateProps } from './marketplace-grid-states.interfaces';

export class MarketplaceLoadingGrid extends React.Component<MarketplaceGridStateProps> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`h-80 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />
        ))}
      </>
    );
  }
}
