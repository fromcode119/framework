"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface TagFieldProps {
  value: string[] | string;
  onChange: (value: string[]) => void;
  placeholder?: string;
  theme?: string;
  collectionSlug?: string;
  fieldName?: string;
  sourceCollection?: string; // If we want to fetch suggestions from another collection
  sourceField?: string;      // The field in the other collection to suggest from
}

export const TagField = ({ 
  value, 
  onChange, 
  placeholder = "Add tag and press Enter...", 
  theme = 'light',
  collectionSlug,
  fieldName,
  sourceCollection,
  sourceField
}: TagFieldProps) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tags = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [value]);

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

        if (!targetCollection || !targetField) return;

        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${targetCollection}/suggestions/${targetField}?q=${inputValue}`);
        if (Array.isArray(result)) {
          setSuggestions(
            result
              .filter(s => typeof s === 'string' && s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s))
          );
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

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className={`w-full min-h-[52px] rounded-2xl py-2.5 px-4 border flex flex-wrap gap-2.5 transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-900/50 border-slate-800 focus-within:border-indigo-500/50 focus-within:bg-slate-900' 
          : 'bg-white border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 shadow-sm'
      }`}>
        {tags.map((tag: string, i: number) => (
          <span 
            key={tag} 
            className="group bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            {tag}
            <button 
              type="button" 
              onClick={() => {
                const newTags = [...tags];
                newTags.splice(i, 1);
                onChange(newTags);
              }}
              className="text-indigo-200 hover:text-white transition-colors p-0.5"
            >
              <FrameworkIcons.Close size={12} strokeWidth={3} />
            </button>
          </span>
        ))}
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
              addTag(inputValue);
            } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
              const newTags = [...tags];
              newTags.pop();
              onChange(newTags);
            }
          } }
          className={`flex-1 min-w-[120px] bg-transparent outline-none text-sm font-bold ${
            theme === 'dark' ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute z-[100] w-full mt-2 rounded-2xl border shadow-2xl p-1.5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden ${
          theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
        }`}>
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Suggestions</span>
            <FrameworkIcons.Search size={10} className="text-slate-400" />
          </div>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className={`w-full text-left px-4 py-3 text-sm rounded-xl transition-all duration-200 flex items-center justify-between group ${
                theme === 'dark' 
                  ? 'hover:bg-slate-800 text-slate-300 hover:text-white' 
                  : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'
              }`}
            >
              <span className="font-bold">{suggestion}</span>
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
