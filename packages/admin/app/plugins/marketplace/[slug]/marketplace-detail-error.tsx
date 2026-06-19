"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceDetailErrorProps } from './marketplace-detail-states.interfaces';

export class MarketplaceDetailError extends React.Component<MarketplaceDetailErrorProps> {
  render(): React.ReactNode {
    const { error, onBack } = this.props;
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
           <FrameworkIcons.Alert size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-slate-500">{error || 'Plugin not found'}</p>
        <button onClick={onBack} className="text-indigo-600 font-semibold hover:underline">
          Back to Marketplace
        </button>
      </div>
    );
  }
}
