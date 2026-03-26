"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { RootFramework } from '@fromcode119/react';
import { FrameworkIcons } from '@/lib/icons';
import { UiFieldUtils } from '@/lib/ui';

interface Option {
  label: string;
  value: string;
  group?: string;
  section?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  theme?: string;
  className?: string;
  triggerClassName?: string;
  label?: string;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSearchChange?: (value: string) => void;
}

export const Select = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select an option...", 
  disabled = false, 
  theme = 'light',
  className = '',
  triggerClassName = '',
  label,
  searchable = true,
  size = 'md',
  onSearchChange
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find(opt => {
    // Ensure both are treated as strings for stable comparison
    const optVal = opt.value && typeof opt.value === 'object' ? (opt.value as any).value || (opt.value as any).id || (opt.value as any).slug : String(opt.value);
    const curVal = value && typeof value === 'object' ? (value as any).value || (value as any).id || (value as any).slug : String(value);
    return optVal === curVal;
  });

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchValue.toLowerCase())
  );
  const groupedFilteredOptions = filteredOptions.reduce((acc, opt) => {
    const groupName = opt.group || 'Options';
    const existingGroup = acc.find((g) => g.name === groupName);
    if (existingGroup) {
      existingGroup.options.push(opt);
    } else {
      acc.push({ name: groupName, options: [opt] });
    }
    return acc;
  }, [] as Array<{ name: string; options: Option[] }>);
  const showGroupHeaders = groupedFilteredOptions.length > 1 || (groupedFilteredOptions.length === 1 && groupedFilteredOptions[0].name !== 'Options');

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const menuHeight = Math.min(filteredOptions.length * 48 + (searchable ? 100 : 40), 300);
      
      let top = rect.bottom + margin;
      // Check if it should open upwards
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - margin;
      }

      setCoords({
        top,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, filteredOptions.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchValue('');
      onSearchChange?.('');
    }
  }, [isOpen, onSearchChange]);

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && <label className={UiFieldUtils.TEXT.LABEL}>{label}</label>}
      <div className="relative w-full" ref={triggerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`${UiFieldUtils.getFieldClasses(size, `flex items-center justify-between text-left group overflow-hidden relative ${triggerClassName}`)} ${isOpen ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`truncate relative z-10 ${!selectedOption ? 'text-slate-400 font-medium' : ''}`}>
             <div className="flex flex-col leading-none">
                {selectedOption ? (
                  <span className="truncate">{selectedOption.label}</span>
                ) : (
                  <span className="truncate">{placeholder ?? ''}</span>
                )}
             </div>
          </span>
          
          <div className={`transition-transform duration-300 relative z-10 ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`}>
            <FrameworkIcons.Down size={14} />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/[0.03] to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
        </button>

        {isOpen && (
          <RootFramework>
            <div 
              ref={menuRef}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 9999
              }}
              className={`max-h-[300px] flex flex-col rounded-lg border shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-300 overflow-hidden ${
                theme === 'dark' 
                  ? 'bg-slate-950/95 border-slate-800/80 backdrop-blur-3xl' 
                  : 'bg-white/95 border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
              }`}
            >
              {searchable && (
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <FrameworkIcons.Search size={12} />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search options..."
                      value={searchValue}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setSearchValue(nextValue);
                        onSearchChange?.(nextValue);
                      }}
                      className={UiFieldUtils.getFieldClasses('sm', 'pl-8')}
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-1 scrollbar-hide">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[11px] font-semibold text-slate-500 tracking-wide opacity-50">No results found</p>
                  </div>
                ) : (
                  groupedFilteredOptions.map((group) => {
                    const sections = group.options.reduce((acc, opt) => {
                      const sectionName = opt.section || '';
                      const existing = acc.find((s) => s.name === sectionName);
                      if (existing) {
                        existing.options.push(opt);
                      } else {
                        acc.push({ name: sectionName, options: [opt] });
                      }
                      return acc;
                    }, [] as Array<{ name: string; options: Option[] }>);
                    const showSectionHeaders = sections.length > 1 || (sections.length === 1 && sections[0].name !== '');

                    return (
                    <div key={group.name} className="mb-0.5 last:mb-0">
                      {showGroupHeaders && (
                        <div className={`px-3.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {group.name}
                        </div>
                      )}
                      {sections.map((section) => (
                        <div key={`${group.name}:${section.name || 'default'}`}>
                          {showSectionHeaders && section.name ? (
                            <div className={`px-4 pt-1 pb-1 text-[10px] font-semibold tracking-wide ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                              {section.name}
                            </div>
                          ) : null}
                          {section.options.map((opt) => (
                        <button
                          key={`${group.name}:${section.name}:${typeof opt.value === 'object' ? JSON.stringify(opt.value) : opt.value}:${opt.label}`}
                          type="button"
                          onClick={() => {
                            const finalVal = opt.value && typeof opt.value === 'object' ? (opt.value as any).value || (opt.value as any).id || (opt.value as any).slug : opt.value;
                            onChange(finalVal);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left ${section.name ? 'pl-8 pr-3' : 'px-3.5'} py-2.5 text-[12px] rounded-lg transition-all duration-200 flex items-center justify-between group relative overflow-hidden mb-0.5 ${
                            (selectedOption && selectedOption === opt)
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                              : theme === 'dark'
                                ? 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                          }`}
                        >
                          <span className={`relative z-10 font-semibold truncate`}>
                            {opt.label}
                          </span>
                          {(selectedOption && selectedOption === opt) ? (
                            <FrameworkIcons.Check size={12} className="relative z-10 flex-shrink-0" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all transform scale-0 group-hover:scale-100 flex-shrink-0" />
                          )}
                        </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )})
                )}
              </div>
            </div>
          </RootFramework>
        )}
      </div>
    </div>
  );
};
