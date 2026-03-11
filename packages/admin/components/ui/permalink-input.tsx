"use client";

import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Button } from './button';
import { ContextHooks } from '@fromcode119/react';
import { FrameworkIcons } from '@/lib/icons';
import type { Collection } from '@fromcode119/core';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { UiFieldUtils } from '@/lib/ui';
import { AdminUrlUtils } from '@/lib/url-utils';

interface PermalinkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  slug?: string;
  collection?: Collection;
  pluginSettings?: Record<string, any>;
}

export const PermalinkInput = ({ value, onChange, placeholder, disabled, id, slug, collection, pluginSettings }: PermalinkInputProps) => {
  const { settings } = ContextHooks.usePlugins();
  const [isEditing, setIsEditing] = useState(false);
  const [useAbsolutePath, setUseAbsolutePath] = useState(false);

  const baseUrl = AdminUrlUtils.resolveFrontendBaseUrl(settings as Record<string, unknown> | null | undefined);
  const structure = settings?.permalink_structure || '/:slug';
  const normalizedValue = String(value || '');
  const isAbsoluteOverride = normalizedValue.startsWith('/');

  // Get collection-specific prefix (e.g. /posts or /blog)
  const collectionPrefix = collection ? AdminCollectionUtils.getCollectionPrefix(collection, pluginSettings) : '';

  const isNumericOnly = structure.includes(':id') && !structure.includes(':slug');
  const isCustomMode = !!normalizedValue;
  const displayValue = (isCustomMode ? normalizedValue.replace(/^\/+/, '') : '') || (isNumericOnly ? (id || '') : (slug || 'unnamed-resource'));

  // Calculate the path based on structure
  const now = new Date();
  const replacements: Record<string, string> = {
    ':year': now.getFullYear().toString(),
    ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
    ':day': now.getDate().toString().padStart(2, '0'),
    ':hour': now.getHours().toString().padStart(2, '0'),
    ':minute': now.getMinutes().toString().padStart(2, '0'),
    ':second': now.getSeconds().toString().padStart(2, '0'),
    ':id': id || '...',
    ':slug': '{SLUG}'
  };

  let formattedStructure = structure;
  
  Object.entries(replacements).forEach(([key, val]) => {
    // If we're in numeric only mode, and we don't have a custom override,
    // we don't want to replace :id yet because we use it for splitting the prefix/suffix.
    if (isNumericOnly && key === ':id' && !isCustomMode) return;
    
    // In any other mode (including Custom Override on a Numeric path), 
    // we replace all tokens.
    formattedStructure = formattedStructure.replace(key, val);
  });

  // LOGIC FOR PREFIX/SUFFIX SPLITTING:
  // 1. If we have an explicit custom override (value), the whole structure logic is bypassed.
  //    The prefix is just the base URL and a slash, and the "editable" part is the value.
  // 2. If we are in Numeric Only mode (/:id) and NO override exists, we split by :id.
  // 3. Otherwise (Standard slug mode), we split by our temporary {SLUG} placeholder.
  
  let prefix = '/';
  let suffix = '';

  if (isNumericOnly && !isCustomMode) {
    const parts = formattedStructure.split(':id');
    prefix = (parts[0] || '/');
    suffix = parts[1] || '';
  } else if (!isCustomMode) {
    const parts = formattedStructure.split('{SLUG}');
    prefix = (parts[0] || '/');
    suffix = parts[1] || '';
  }

  // Inject the collection prefix between the domain and the structure-based prefix
  // e.g. domain.com + /posts + /2026/slug -> domain.com/posts/2026/slug
  let finalPrefix = prefix;
  if (!isAbsoluteOverride && collectionPrefix) {
    finalPrefix = `/${collectionPrefix}${prefix}`.replace(/\/+/g, '/');
  }

  const fullDisplayPrefix = `${baseUrl}${finalPrefix}`;

  useEffect(() => {
    if (!isEditing) {
      setUseAbsolutePath(isAbsoluteOverride);
    }
  }, [isEditing, isAbsoluteOverride]);

  const handleValueChange = (nextValue: string) => {
    const normalizedNext = String(nextValue || '').replace(/^\/+/, '');
    onChange(useAbsolutePath ? `/${normalizedNext}` : normalizedNext);
  };

  if (!isEditing) {
    return (
      <div 
        onClick={() => !disabled && setIsEditing(true)}
        title={`${fullDisplayPrefix}${displayValue}${suffix}`}
        className={`group relative min-h-[56px] px-3.5 py-2 rounded-lg border transition-all overflow-hidden ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3 w-full">
           <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] leading-tight text-slate-400 font-medium break-all opacity-70">{fullDisplayPrefix}</span>
              <span className={`text-[13px] leading-tight font-semibold break-all ${isCustomMode ? 'text-indigo-600' : 'text-slate-900 dark:text-white'}`}>
                {displayValue}{suffix}
              </span>
           </div>
           <div className="flex items-start gap-2 shrink-0 pt-0.5">
              {isCustomMode && (
                 <div className="h-5 px-1.5 flex items-center bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-md border border-indigo-500/20">
                    {isAbsoluteOverride ? 'Absolute Path' : 'Custom Path'}
                 </div>
              )}
              <div className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                 <FrameworkIcons.Edit size={12} />
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-end px-1">
        <label className={UiFieldUtils.TEXT.LABEL}>Edit Path Override</label>
        {isCustomMode && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsEditing(false); }}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
          >
            <FrameworkIcons.Refresh size={8} />
            Revert
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const nextAbsolute = !useAbsolutePath;
          setUseAbsolutePath(nextAbsolute);
          const normalizedCurrent = String(displayValue || '').replace(/^\/+/, '');
          onChange(nextAbsolute ? `/${normalizedCurrent}` : normalizedCurrent);
        }}
        className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
          useAbsolutePath
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        {useAbsolutePath
          ? 'Absolute path override enabled: this record bypasses the global prefix.'
          : 'Relative path mode: this record inherits the global collection prefix.'}
      </button>

      <div className="flex flex-col gap-2">
        <div className={`${UiFieldUtils.getFieldClasses('md', 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl bg-white dark:bg-slate-950 px-3.5 py-0 flex flex-col justify-center', false)}`}>
           <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 opacity-60 leading-none mb-1">
              <FrameworkIcons.Layout size={10} />
              <span className="truncate">{baseUrl}{useAbsolutePath ? '/' : finalPrefix}</span>
           </div>
           <input 
              autoFocus
              value={displayValue ?? ''}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full bg-transparent text-[13px] font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 leading-none"
              placeholder="my-secret-path"
           />
        </div>

        <div className="flex gap-2">
           <Button 
              className="flex-1 font-bold text-[11px]"
              onClick={() => setIsEditing(false)}
           >
              Save Override
           </Button>
           <Button 
              variant="ghost"
              className="px-4 text-[11px] font-bold"
              onClick={() => setIsEditing(false)}
           >
              Cancel
           </Button>
        </div>
      </div>
      <p className={UiFieldUtils.TEXT.SUBTEXT}>
        Relative overrides inherit the collection prefix. Enable absolute mode to bypass prefixes like `/shop`.
      </p>
    </div>
  );
};
