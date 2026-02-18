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

export const PluginEmptyState = ({ 
  icon, 
  title, 
  description, 
  action,
  className = ""
}: PluginEmptyStateProps) => {
  return (
    <div 
      className={`
        flex flex-col items-center justify-center 
        rounded-[2.5rem] border-2 border-dashed border-slate-300/60 
        bg-slate-50/30 
        py-24 px-8 
        text-center
        dark:bg-slate-800/20 
        dark:border-slate-700/50
        ${className}
      `}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-6 p-6 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200/50 text-slate-400 dark:from-slate-800 dark:to-slate-700/50 dark:text-slate-500">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 tracking-tight uppercase mb-3">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="
            px-6 py-3 
            rounded-full 
            bg-gradient-to-r from-indigo-600 to-indigo-700 
            text-white 
            text-xs font-black uppercase tracking-wider
            transition-all duration-300 
            hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105
            active:scale-95
          "
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
