"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { UiFieldUtils } from '@/lib/ui';
import { AdminServices } from '@/lib/admin-services';
import { TagFieldUtils } from './tag-field-utils';

interface TagFieldProps {
  value: string[] | string;
  onChange: (value: string[] | string) => void;
  placeholder?: string;
  suggestionsLabel?: string;
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
  placeholder,
  suggestionsLabel,
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
  const [sourceUnavailableMessage, setSourceUnavailableMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const inferredFieldLabel = TagFieldUtils.inferFieldLabel(fieldName);
  const sourceCollectionCandidates = React.useMemo(
    () => TagFieldUtils.resolveCollectionCandidates(String(sourceCollection || '')),
    [sourceCollection]
  );
  const effectivePlaceholder = placeholder || (sourceCollection ? `Search ${inferredFieldLabel}...` : `Add ${inferredFieldLabel} and press Enter...`);
  const effectiveSuggestionsLabel =
    suggestionsLabel ||
    `Existing ${inferredFieldLabel}`;
  const createEntityLabel = inferredFieldLabel;

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
      if (sourceUnavailableMessage) return;
      
      const missing = tags.filter(t => !labels[t]);
      if (missing.length === 0) return;

      try {
        const searchKey = sourceField || 'slug';
        // Simple search for the missing ones. 
        // In a real app we'd use an 'in' operator if supported.
        const newLabels = { ...labels };
        await Promise.all(missing.map(async (t) => {
           try {
             let doc: any = null;

             const collectionsToTry = sourceCollectionCandidates.length
               ? sourceCollectionCandidates
               : [String(sourceCollection || '').trim()];

             for (const candidateCollection of collectionsToTry) {
               if (!candidateCollection || doc) break;

               // First try direct ID lookup for numeric values (relationship chips usually store ids).
               if (!apiOverrides?.search && !isNaN(Number(t))) {
                 try {
                   const byIdUrl = `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}/${t}`;
                   const byId = await AdminApi.get(byIdUrl);
                   if (byId && (byId.id || byId._id || byId.slug)) {
                     doc = byId;
                     break;
                   }
                 } catch {
                   // ignore and continue with field lookup fallback
                 }
               }

               try {
                 const url = apiOverrides?.search
                   ? `${apiOverrides.search}?q=${encodeURIComponent(t)}`
                   : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}?${searchKey}=${encodeURIComponent(t)}&limit=1`;

                 const res = await AdminApi.get(url);
                 const maybeDoc = apiOverrides?.search ? res : res.docs?.[0];
                 if (maybeDoc) {
                   doc = maybeDoc;
                   break;
                 }
               } catch {
                 // try next collection candidate
               }
             }

             if (doc) {
               newLabels[t] = AdminServices.getInstance().localization.resolveLabelText(doc) || t;
             } else {
                newLabels[t] = t;
             }
           } catch (e: any) {
             const message = String(e?.message || '');
             if (e?.status === 403 && message.includes('is unavailable because plugin')) {
               setSourceUnavailableMessage(message);
             }
           }
        }));
        setLabels((prev) => ({ ...prev, ...newLabels }));
      } catch (err) {}
    };
    fetchLabels();
  }, [tags, sourceCollection, sourceCollectionCandidates, sourceUnavailableMessage]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      // If it's a relationship field (sourceCollection exists), we allow empty input to show initial suggestions
      if (inputValue.length < 1 && !sourceCollection) {
        setSuggestions([]);
        return;
      }
      if (sourceCollection && sourceUnavailableMessage) {
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
        const collectionsToTry = sourceCollection
          ? sourceCollectionCandidates
          : [String(targetCollection || '').trim()];
        const q = encodeURIComponent(inputValue);

        let result: any = null;
        let lastError: any = null;
        if (apiOverrides?.suggest) {
          result = await AdminApi.get(`${apiOverrides.suggest}?q=${q}`);
        } else {
          for (const candidateCollection of collectionsToTry) {
            if (!candidateCollection) continue;
            const url = isRelationship
              ? `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}?limit=10${inputValue ? `&search=${q}` : ''}`
              : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}/suggestions/${targetField}?q=${q}&limit=10`;
            try {
              result = await AdminApi.get(url);
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
            }
          }

          if (!result && lastError) {
            throw lastError;
          }
        }
        setSourceUnavailableMessage('');
        
        // Handle both array responses and paginated responses
        const docs = Array.isArray(result) ? result : (result.docs || []);
        
        if (docs.length > 0) {
          const mapped: TagOption[] = docs.map((item: any) => {
            if (typeof item === 'string') return { label: item, value: item };
            if (typeof item === 'object' && item !== null) {
              // For relationships, keep stable identifiers (id/slug) as value.
              // sourceField should affect label/search, not stored relation key.
              let rawValue =
                sourceCollection
                  ? (item.id ?? item._id ?? item.value ?? item.slug)
                  : (
                      (sourceField && item[sourceField] !== undefined && item[sourceField] !== null
                        ? item[sourceField]
                        : undefined) ??
                      item.value ??
                      item.slug ??
                      item.id ??
                      item.name ??
                      item.label
                    );

              if (typeof rawValue === 'object' && rawValue !== null) {
                rawValue = AdminServices.getInstance().localization.resolveLabelText(rawValue);
              }

              const value = String(rawValue || '').trim();
              const label = String(AdminServices.getInstance().localization.resolveLabelText(item) || value || 'Unknown').trim();

              return { label, value: value || label };
            }
            return { label: String(item), value: String(item) };
          });

          // Filter out if value is missing or already selected
          setSuggestions(
            mapped.filter(s => s.value && !tags.includes(s.value))
          );
          
          // Update labels map with suggestion info
          const newLabels: Record<string, string> = {};
          mapped.forEach(m => { if (m.value) newLabels[m.value] = m.label; });
          setLabels((prev) => ({ ...prev, ...newLabels }));
        }
      } catch (err) {
        const message = String((err as any)?.message || '');
        const status = (err as any)?.status;
        if (status === 403 && message.includes('is unavailable because plugin')) {
          setSourceUnavailableMessage(message);
          setSuggestions([]);
          return;
        }
        console.error("Failed to fetch suggestions", err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [inputValue, collectionSlug, fieldName, tags, sourceCollection, sourceCollectionCandidates, sourceField, showSuggestions]);

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
            : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}?${searchKey}=${encodeURIComponent(strValue)}&limit=1`;

          const existing = await AdminApi.get(searchUrl);
          const hasExisting = apiOverrides?.search ? !!existing : (existing.docs && existing.docs.length > 0);
          
          if (!hasExisting) {
            const payload: Record<string, any> = {
              name: strValue,
              slug: AdminServices.getInstance().string.slugify(strValue)
            };
            const createUrl = apiOverrides?.create || `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}`;
            await AdminApi.post(createUrl, payload);
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
    ? UiFieldUtils.getFieldClasses(size, 'flex flex-wrap gap-2', true)
    : UiFieldUtils.getFieldClasses(size, 'flex items-center gap-2', false);

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
                placeholder={tags.length === 0 ? effectivePlaceholder : ''}
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

      {showSuggestions && (inputValue.length > 0 || suggestions.length > 0 || !!sourceUnavailableMessage) && (
        <div className={`absolute z-[100] w-full mt-2 rounded-lg border shadow-2xl p-1 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden ${
          theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white/90 border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
        }`}>
          {sourceUnavailableMessage && (
            <div className={`px-3.5 py-3 rounded-lg text-[11px] font-semibold ${
              theme === 'dark'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {sourceUnavailableMessage}
            </div>
          )}

          {suggestions.length > 0 && (
            <>
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">{effectiveSuggestionsLabel}</span>
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

          {inputValue.length > 0 && !sourceUnavailableMessage && !suggestions.some(s => s.value === inputValue || s.label === inputValue) && (
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
                      {allowCreate ? `Create ${createEntityLabel}` : `Use Custom ${createEntityLabel}`}
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
