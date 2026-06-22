"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceGridStateProps } from './marketplace-grid-states.interfaces';

export class MarketplaceEmptyState extends React.Component<MarketplaceGridStateProps> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <div className="col-span-full py-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
          <FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" />
        </div>
        <h3 className={`text-lg font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3>
        <p className="text-slate-500 font-medium">Try a different search term or check your marketplace connection.</p>
      </div>
    );
  }
}
