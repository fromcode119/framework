"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

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
  apiOverrides
}: TagFieldProps) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const tags = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      if (!hasMany) return [value];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch (e) {
        return [value];
      }
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
             const doc = apiOverrides?.search ? res : res.docs?.[0];
             
             if (doc) {
                newLabels[t] = doc.name || doc.title || t;
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
      if (inputValue.length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        // Use provided source or fallback to context collection
        const targetCollection = sourceCollection || collectionSlug;
        const targetField = sourceField || fieldName;

        if (!targetCollection && !apiOverrides?.suggest) return;

        const url = apiOverrides?.suggest
          ? `${apiOverrides.suggest}?q=${inputValue}`
          : `${ENDPOINTS.COLLECTIONS.BASE}/${targetCollection}/suggestions/${targetField}?q=${inputValue}`;

        const result = await api.get(url);
        if (Array.isArray(result)) {
           // Mapping result to TagOption if it's not already
           const mapped: TagOption[] = result.map(item => {
             if (typeof item === 'string') return { label: item, value: item };
             return item;
           });

          setSuggestions(
            mapped
              .filter(s => s.label.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s.value))
          );
          
          // Update labels map with suggestion info
          const newLabels = { ...labels };
          mapped.forEach(m => { newLabels[m.value] = m.label; });
          setLabels(newLabels);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions");
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [inputValue, collectionSlug, fieldName, tags, sourceCollection, sourceField]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      let finalValue = trimmed;

      // If we have a source collection, we ensure the entry exists
      if (allowCreate && (sourceCollection || apiOverrides?.create)) {
        try {
          const searchKey = sourceField || 'slug';
          const searchUrl = apiOverrides?.search
            ? `${apiOverrides.search}?q=${encodeURIComponent(trimmed)}`
            : `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}?${searchKey}=${encodeURIComponent(trimmed)}&limit=1`;

          const existing = await api.get(searchUrl);
          const hasExisting = apiOverrides?.search ? !!existing : (existing.docs && existing.docs.length > 0);
          
          if (!hasExisting) {
            // Auto-create the missing tag/category
            const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
            
            const payload: Record<string, any> = {
              name: trimmed,
              slug: slugify(trimmed)
            };
            
            const createUrl = apiOverrides?.create || `${ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}`;
            
            // Try to create it. If it fails (e.g. fields don't match), we still add the tag to the local list
            await api.post(createUrl, payload);
          }
        } catch (err) {
          console.error("Tag auto-creation failed, proceeding with local add only.", err);
        }
      }

      if (hasMany) {
        onChange([...tags, finalValue]);
      } else {
        onChange(finalValue);
      }
      
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleAddClick = async (tag: string) => {
      setIsCreating(true);
      await addTag(tag);
      setIsCreating(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className={`w-full min-h-[52px] rounded-2xl py-2.5 px-4 border flex flex-wrap gap-2.5 transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-900/50 border-slate-800 focus-within:border-indigo-500/50 focus-within:bg-slate-900' 
          : 'bg-white border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 shadow-sm'
      }`}>
        {tags.map((tag: string, i: number) => {
          const label = labels[tag] || tag;
          const isRelation = !!sourceCollection;
          
          return (
            <span 
              key={tag} 
              className="group bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-black uppercase tracking-widest leading-none mb-0.5">{label}</span>
                 {isRelation && label !== tag && <span className="text-[11px] font-black opacity-50 tracking-tighter uppercase leading-none">{tag}</span>}
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
                className="text-indigo-200 hover:text-white transition-colors p-0.5 ml-1"
              >
                <FrameworkIcons.Close size={12} strokeWidth={3} />
              </button>
            </span>
          );
        })}
        <div className="flex-1 flex items-center gap-2 min-w-[150px]">
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
                className={`w-full bg-transparent outline-none text-sm font-bold ${
                    theme === 'dark' ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                />
            )}
            {isCreating && <FrameworkIcons.Loader size={12} className="animate-spin text-indigo-500" />}
        </div>
      </div>

      {showSuggestions && (inputValue.length > 0 || suggestions.length > 0) && (
        <div className={`absolute z-[100] w-full mt-2 rounded-2xl border shadow-2xl p-1.5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden ${
          theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
        }`}>
          {suggestions.length > 0 && (
            <>
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">Existing {sourceCollection || 'Tags'}</span>
                    <FrameworkIcons.Search size={10} className="text-slate-400" />
                </div>
                {suggestions.map((suggestion) => (
                    <button
                    key={suggestion.value}
                    type="button"
                    onClick={() => handleAddClick(suggestion.value)}
                    className={`w-full text-left px-4 py-3 text-sm rounded-xl transition-all duration-200 flex items-center justify-between group ${
                        theme === 'dark' 
                        ? 'hover:bg-slate-800 text-slate-300 hover:text-white' 
                        : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'
                    }`}
                    >
                    <div className="flex flex-col">
                        <span className="font-bold">{suggestion.label}</span>
                        {suggestion.label !== suggestion.value && (
                           <span className="text-[11px] opacity-50 font-black uppercase tracking-widest">{suggestion.value}</span>
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
                onClick={() => handleAddClick(inputValue)}
                className={`w-full text-left px-4 py-3 text-sm rounded-xl transition-all duration-200 flex items-center gap-3 group mt-1 ${
                    theme === 'dark' 
                    ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <FrameworkIcons.Plus size={16} strokeWidth={3} />
                </div>
                <div className="flex-1">
                    <span className="font-black uppercase text-[12px] tracking-widest block">
                      {allowCreate ? `Create New ${sourceCollection?.slice(0, -1) || 'Tag'}` : `Use Custom ${fieldName || 'Value'}`}
                    </span>
                    <span className="font-bold text-sm block mt-0.5">"{inputValue}"</span>
                </div>
              </button>
          )}
        </div>
      )}
    </div>
  );
};
