"use client";

import React from 'react';
import type { PublisherTypeTabsProps } from './publisher-portal.interfaces';

export class PublisherTypeTabs extends React.Component<PublisherTypeTabsProps> {
  render(): React.ReactNode {
    const { theme, submissionType, onSelect } = this.props;
    return (
      <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => onSelect('plugin')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${submissionType === 'plugin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Plugins
        </button>
        <button
          onClick={() => onSelect('theme')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${submissionType === 'theme' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Themes
        </button>
      </div>
    );
  }
}
