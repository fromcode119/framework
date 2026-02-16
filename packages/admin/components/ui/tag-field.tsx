"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { UI_FIELD, UI_COMMON, getFieldClasses } from '@/lib/ui';
import { resolveLabelText } from '@/lib/utils';

interface TagFieldProps {
  value: string[] | string;
  onChange: (value: string[] | string) => void;
  placeholder?: string;
  theme?: string;
  collectionSlug?: string;
  fieldName?: string;
  sourceCollection?: string; // If we want to fetch suggestions from another collection
  sourceField?: string;      // The field in the other collection to suggest from
  hasMany?: boolean;         // Default true, if false it acts as a single select
  allowCreate?: boolean;     // Whether to allow creating new entries in the source collection
  size?: 'sm' | 'md' | 'lg';
  apiOverrides?: {
    search?: string;
    suggest?: string;
    create?: string;
  };
}

interface TagOption {
  label: string;
  value: string;
}

export const TagField = ({ 
  value, 
  onChange, 
  placeholder = "Add tag and press Enter...", 
  theme = 'light',
  collectionSlug,
  fieldName,
  sourceCollection,
  sourceField,
  hasMany = true,
  allowCreate = true,
  size = 'md',
  apiOverrides
}: TagFieldProps) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const tags = React.useMemo(() => {
    if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined);
    if (value !== null && value !== undefined && typeof value === 'string' && value.trim()) {
      if (!hasMany) return [value];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(v => v !== null && v !== undefined) : [value];
      } catch (e) {
        return [value];
      }
    }
    if (value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'string') {
        return [String(value)];
    }
    return [];
  }, [value, hasMany]);

  // Fetch missing labels for current tags
  useEffect(() => {
    const fetchLabels = async () => {
      if (!sourceCollection || tags.length === 0) return;
      
      const missing = tags.filter(t => !labels[t]);
      if (missing.length === 0) return;

      try {
        const searchKey = sourceField || 'slug';
        // Simple search for the missing ones. 
        // In a real app we'd use an 'in' operator if supported.
        const newLabels = { ...labels };
        await Promise.all(missing.map(async (t) => {
           try {
             const url = apiOverrides?.search 
               ? `${apiOverrides.search}?q=${encodeURIComponent(t)}`
               : `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}?${searchKey}=${encodeURIComponent(t)}&limit=1`;
             
             const res = await api.get(url);
             let doc = apiOverrides?.search ? res : res.docs?.[0];
             
             // Fallback: If no document found by the source field (e.g. slug/username),
             // and the tag value is a number, try fetching by ID directly
             if (!doc && !apiOverrides?.search && !isNaN(Number(t)) && sourceCollection) {
                try {
                    const fallbackUrl = `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}/${t}`;
                    const fallbackRes = await api.get(fallbackUrl);
                    if (fallbackRes && (fallbackRes.id || fallbackRes._id)) {
                        doc = fallbackRes;
                    }
                } catch (fallbackErr) {
                    // Ignore fallback error
                }
             }

             if (doc) {
               newLabels[t] = resolveLabelText(doc) || t;
             } else {
                newLabels[t] = t;
             }
           } catch (e) {}
        }));
        setLabels(newLabels);
      } catch (err) {}
    };
    fetchLabels();
  }, [tags, sourceCollection]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      // If it's a relationship field (sourceCollection exists), we allow empty input to show initial suggestions
      if (inputValue.length < 1 && !sourceCollection) {
        setSuggestions([]);
        return;
      }

      try {
        // Use provided source or fallback to context collection
        const targetCollection = sourceCollection || collectionSlug;
        const targetField = sourceField || fieldName;

        if (!targetCollection && !apiOverrides?.suggest) return;

        // Use source collection search for relationships, or suggestions for flat tags
        const isRelationship = !!sourceCollection;
        const q = encodeURIComponent(inputValue);

        const url = apiOverrides?.suggest
          ? `${apiOverrides.suggest}?q=${q}`
          : isRelationship
            ? `${ENDPOINTS.COLLECTIONS.BASE}/${targetCollection}?limit=10${inputValue ? `&search=${q}` : ''}`
            : `${ENDPOINTS.COLLECTIONS.BASE}/${targetCollection}/suggestions/${targetField}?q=${q}&limit=10`;

        const result = await api.get(url);
        
        // Handle both array responses and paginated responses
        const docs = Array.isArray(result) ? result : (result.docs || []);
        
        if (docs.length > 0) {
          const mapped: TagOption[] = docs.map(item => {
            if (typeof item === 'string') return { label: item, value: item };
            if (typeof item === 'object' && item !== null) {
              const sourceValue =
                sourceField && item[sourceField] !== undefined && item[sourceField] !== null
                  ? item[sourceField]
                  : undefined;

              let rawValue =
                sourceValue ??
                item.value ??
                item.slug ??
                item.id ??
                item.name ??
                item.label;

              if (typeof rawValue === 'object' && rawValue !== null) {
                rawValue = resolveLabelText(rawValue);
              }

              const value = String(rawValue || '').trim();
              const label = String(resolveLabelText(item) || value || 'Unknown').trim();

              return { label, value: value || label };
            }
            return { label: String(item), value: String(item) };
          });

          // Filter out if value is missing or already selected
          setSuggestions(
            mapped.filter(s => s.value && !tags.includes(s.value))
          );
          
          // Update labels map with suggestion info
          const newLabels = { ...labels };
          mapped.forEach(m => { if (m.value) newLabels[m.value] = m.label; });
          setLabels(newLabels);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [inputValue, collectionSlug, fieldName, tags, sourceCollection, sourceField, showSuggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = (tag: any) => {
    if (tag === null || tag === undefined) return;
    const strValue = String(tag).trim();
    if (!strValue) return;

    // Filter out if already exists (for hasMany)
    if (hasMany && tags.includes(strValue)) {
      setInputValue('');
      setShowSuggestions(false);
      return;
    }

    const finalValue = strValue;

    // UI update first for responsiveness
    if (hasMany) {
      onChange([...tags, finalValue]);
    } else {
      // Direct pass-through of the string value to prevent object wrapping
      onChange(finalValue);
    }
    
    setInputValue('');
    setShowSuggestions(false);

    // Then background auto-creation if enabled
    if (allowCreate && (sourceCollection || apiOverrides?.create)) {
      // Use IIFE or a separate async call to not block UI
      (async () => {
        try {
          const searchKey = sourceField || 'slug';
          const searchUrl = apiOverrides?.search
            ? `${apiOverrides.search}?q=${encodeURIComponent(strValue)}`
            : `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}?${searchKey}=${encodeURIComponent(strValue)}&limit=1`;

          const existing = await api.get(searchUrl);
          const hasExisting = apiOverrides?.search ? !!existing : (existing.docs && existing.docs.length > 0);
          
          if (!hasExisting) {
            const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
            const payload: Record<string, any> = {
              name: strValue,
              slug: slugify(strValue)
            };
            const createUrl = apiOverrides?.create || `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}`;
            await api.post(createUrl, payload);
          }
        } catch (err) {
          console.error("Tag auto-creation failed:", err);
        }
      })();
    }
  };

  const [isCreating, setIsCreating] = useState(false);

  const inputTextSizeClass = size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-sm' : 'text-[13px]';
  const wrapperClasses = hasMany
    ? getFieldClasses(size, 'flex flex-wrap gap-2', true)
    : getFieldClasses(size, 'flex items-center gap-2', false);

  const handleAddClick = (tag: any) => {
      // Direct synchronous call to ensure state transitions happen immediately
      addTag(tag);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className={wrapperClasses}>
        {tags.map((tag: string, i: number) => {
          const label = labels[tag] || tag;
          
          return (
            <span 
              key={tag} 
              className="group bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-95 transition-all"
            >
              <div className="flex flex-col leading-tight">
                 <span className="text-[11px] font-semibold leading-none mb-0">{label}</span>
                 {!sourceCollection && label !== tag && <span className="text-[9px] font-medium opacity-70 leading-none mt-0.5">{tag}</span>}
              </div>
              <button 
                type="button" 
                onClick={() => {
                  if (hasMany) {
                    const newTags = [...tags];
                    newTags.splice(i, 1);
                    onChange(newTags);
                  } else {
                    onChange('');
                  }
                }}
                className="text-indigo-200 hover:text-white transition-colors p-0"
              >
                <FrameworkIcons.Close size={10} strokeWidth={3} />
              </button>
            </span>
          );
        })}
        <div className="flex-1 flex items-center gap-2 min-w-[120px]">
            {(!hasMany && tags.length > 0) ? null : (
                <input 
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={tags.length === 0 ? placeholder : ''}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (inputValue.trim()) handleAddClick(inputValue);
                    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
                        const newTags = [...tags];
                        newTags.pop();
                        onChange(hasMany ? newTags : '');
                    }
                } }
                className={`w-full bg-transparent outline-none ${inputTextSizeClass} font-semibold ${
                    theme === 'dark' ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                />
            )}
            {isCreating && <FrameworkIcons.Loader size={12} className="animate-spin text-indigo-500" />}
        </div>
      </div>

      {showSuggestions && (inputValue.length > 0 || suggestions.length > 0) && (
        <div className={`absolute z-[100] w-full mt-2 rounded-lg border shadow-2xl p-1 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden ${
          theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white/90 border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
        }`}>
          {suggestions.length > 0 && (
            <>
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Existing {sourceCollection || 'Tags'}</span>
                    <FrameworkIcons.Search size={10} className="text-slate-400" />
                </div>
                {suggestions.map((suggestion) => (
                    <button
                    key={suggestion.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddClick(suggestion.value);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-[13px] rounded-lg transition-all duration-200 flex items-center justify-between group ${
                        theme === 'dark' 
                        ? 'hover:bg-slate-800 text-slate-300 hover:text-white' 
                        : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'
                    }`}
                    >
                    <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{suggestion.label}</span>
                        {!sourceCollection && suggestion.label !== suggestion.value && (
                           <span className="text-[10px] opacity-50 font-medium tracking-wide">{suggestion.value}</span>
                        )}
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
                    </button>
                ))}
            </>
          )}

          {inputValue.length > 0 && !suggestions.some(s => s.value === inputValue || s.label === inputValue) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddClick(inputValue);
                }}
                className={`w-full text-left px-3.5 py-2 text-[13px] rounded-lg transition-all duration-200 flex items-center gap-3 group mt-1 ${
                    theme === 'dark' 
                    ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <FrameworkIcons.Plus size={16} strokeWidth={3} />
                </div>
                <div className="flex-1">
                    <span className="font-semibold text-[10px] block leading-none">
                      {allowCreate ? `Create New ${sourceCollection?.slice(0, -1) || 'Tag'}` : `Use Custom ${fieldName || 'Value'}`}
                    </span>
                    <span className="font-semibold text-[13px] block mt-1">"{inputValue}"</span>
                </div>
              </button>
          )}
        </div>
      )}
    </div>
  );
};
