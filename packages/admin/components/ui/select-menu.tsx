"use client";

import React from 'react';
import { RootFramework } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import { SelectUtils } from './select-utils';
import type { SelectMenuProps } from './select.interfaces';

export class SelectMenu extends React.Component<SelectMenuProps> {
  render(): React.ReactNode {
    const {
      theme, searchable, searchValue, coords, filteredOptions, groupedFilteredOptions,
      showGroupHeaders, selectedOption, menuRef, searchInputRef, onSearchChange, onSelect,
    } = this.props;
    const isDarkTheme = theme === 'dark';
    const searchInputThemeClasses = isDarkTheme
      ? '!bg-slate-900/60 !border-slate-800 !text-white caret-white placeholder:text-slate-600 hover:!border-indigo-500/50 focus:!border-indigo-500 focus:!ring-0 [color-scheme:dark]'
      : '';

    return (
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
                      onChange={(e) => onSearchChange(e.target.value)}
                      className={UiFieldUtils.getFieldClasses('sm', `pl-8 ${searchInputThemeClasses}`)}
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
                    const sections = SelectUtils.sections(group.options);
                    const showSectionHeaders = SelectUtils.showSectionHeaders(sections);

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
                          onClick={() => onSelect(SelectUtils.normalizeValue(opt.value))}
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
    );
  }
}
