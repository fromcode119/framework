"use client";

import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { usePlugins } from '@fromcode/react';
import { FrameworkIcons } from '@/lib/icons';
import type { Collection } from '@fromcode/core';
import { getCollectionPrefix } from '@/lib/collection-utils';

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
  const { settings } = usePlugins();
  const [isEditing, setIsEditing] = useState(false);

  const frontendUrl = settings?.frontend_url || 
                      settings?.site_url || 
                      'http://localhost:3002';
  const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
  const structure = settings?.permalink_structure || '/:slug';

  // Get collection-specific prefix (e.g. /posts or /blog)
  const collectionPrefix = collection ? getCollectionPrefix(collection, pluginSettings) : '';

  const isNumericOnly = structure.includes(':id') && !structure.includes(':slug');
  const isCustomMode = !!value;
  const displayValue = value || (isNumericOnly ? (id || '') : (slug || 'unnamed-resource'));

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
  if (collectionPrefix) {
    finalPrefix = `/${collectionPrefix}${prefix}`.replace(/\/+/g, '/');
  }

  const fullDisplayPrefix = `${baseUrl}${finalPrefix}`;

  if (!isEditing) {
    return (
      <div 
        onClick={() => !disabled && setIsEditing(true)}
        className={`group relative p-4 rounded-2xl border transition-all overflow-hidden ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
           <div className="flex flex-col min-w-0">
              <span className="text-xs text-slate-400 font-bold truncate opacity-60 mb-1">{fullDisplayPrefix}</span>
              <span className={`text-xs font-bold leading-tight truncate ${isCustomMode ? 'text-indigo-500' : 'text-slate-900 dark:text-white'}`}>
                {displayValue}{suffix}
              </span>
           </div>
           <div className="flex items-center gap-2 shrink-0">
              {isCustomMode && (
                 <div className="h-5 px-1.5 flex items-center bg-indigo-500/10 text-indigo-500 text-[10px] font-bold rounded-md border border-indigo-500/20">
                    Custom
                 </div>
              )}
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-500/30 transition-all shadow-sm">
                 <FrameworkIcons.Edit size={12} />
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-end px-1">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs font-bold text-indigo-500">Edit Path Override</label>
        </div>
        {isCustomMode && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsEditing(false); }}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
          >
            <FrameworkIcons.Refresh size={8} />
            Revert to Original
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-950 shadow-2xl transition-all border-indigo-500 ring-4 ring-indigo-500/10">
           <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-slate-400 opacity-60">
              <FrameworkIcons.Layout size={10} />
              <span>{baseUrl}{finalPrefix}</span>
           </div>
           <input 
              autoFocus
              value={displayValue ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full bg-transparent text-lg font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
              placeholder="my-secret-path"
           />
        </div>

        <div className="flex gap-2">
           <Button 
              className="flex-1 rounded-xl h-10 font-bold text-xs"
              onClick={() => setIsEditing(false)}
           >
              Save Custom Permalink
           </Button>
           <Button 
              variant="ghost"
              className="px-4 rounded-xl h-10 text-xs font-bold"
              onClick={() => setIsEditing(false)}
           >
              Cancel
           </Button>
        </div>
      </div>
      <p className="px-1 text-xs text-slate-400 font-bold leading-relaxed opacity-70">
        Changes made here override the global schema. For pattern-based slugs, use the title field.
      </p>
    </div>
  );
};
