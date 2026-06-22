"use client";

import React from 'react';

interface PluginEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export class PluginEmptyState extends React.Component<PluginEmptyStateProps> {
  render(): React.ReactNode {
    const { 
  icon, 
  title, 
  description, 
  action,
  className = ""
} = this.props;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/70 bg-slate-50/40 py-12 px-6 text-center dark:bg-slate-800/20 dark:border-slate-700/50 ${className}`}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-3 h-12 w-12 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 tracking-tight mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
  }
}
