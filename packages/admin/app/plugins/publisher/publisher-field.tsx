"use client";

import React from 'react';
import type { PublisherFieldShellProps } from './publisher-portal.interfaces';

export class PublisherFieldShell extends React.Component<PublisherFieldShellProps> {
  render(): React.ReactNode {
    const { theme, label, children } = this.props;
    return (
      <div className="space-y-2">
        <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</label>
        {children}
      </div>
    );
  }
}
