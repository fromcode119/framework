"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceSearchBarProps } from './marketplace-card.interfaces';

export class MarketplaceSearchBar extends React.Component<MarketplaceSearchBarProps> {
  render(): React.ReactNode {
    const { theme, searchQuery, onChange } = this.props;
    return (
      <div className="relative flex-1 group">
        <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
        <input
          type="text"
          placeholder="Search global marketplace..."
          value={searchQuery}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-9 rounded-xl pl-11 pr-4 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-sm' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-sm'}`}
        />
      </div>
    );
  }
}
