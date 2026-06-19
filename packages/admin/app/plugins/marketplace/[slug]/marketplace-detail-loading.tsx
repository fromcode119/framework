"use client";

import React from 'react';
import type { MarketplaceDetailLoadingProps } from './marketplace-detail-states.interfaces';

export class MarketplaceDetailLoading extends React.Component<MarketplaceDetailLoadingProps> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading plugin details...
        </p>
      </div>
    );
  }
}
