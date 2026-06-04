"use client";

import React from 'react';
import { RootFramework } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
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
  clearable?: boolean;
}

interface SelectState {
  isOpen: boolean;
  searchValue: string;
  coords: { top: number; left: number; width: number };
}

export class Select extends React.Component<SelectProps, SelectState> {
  private readonly triggerRef = React.createRef<HTMLDivElement>();
  private readonly menuRef = React.createRef<HTMLDivElement>();
  private readonly searchInputRef = React.createRef<HTMLInputElement>();

  state: SelectState = { isOpen: false, searchValue: '', coords: { top: 0, left: 0, width: 0 } };

  private getFilteredOptions(): Option[] {
    const searchValue = this.state.searchValue;
    return this.props.options.filter(opt =>
      opt.label.toLowerCase().includes(searchValue.toLowerCase())
    );
  }

  private updatePosition = (): void => {
    if (this.triggerRef.current) {
      const rect = this.triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const filteredCount = this.getFilteredOptions().length;
      const menuHeight = Math.min(filteredCount * 48 + (this.props.searchable !== false ? 100 : 40), 300);

      let top = rect.bottom + margin;
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - margin;
      }

      this.setState({ coords: { top, left: rect.left, width: rect.width } });
    }
  };

  private handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (
      this.triggerRef.current && !this.triggerRef.current.contains(target) &&
      this.menuRef.current && !this.menuRef.current.contains(target)
    ) {
      this.setState({ isOpen: false });
    }
  };

  private addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
    if (this.props.searchable !== false) {
      setTimeout(() => this.searchInputRef.current?.focus(), 50);
    }
  }

  private removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.state.isOpen) this.addPositionListeners();
  }

  componentDidUpdate(_prevProps: SelectProps, prevState: SelectState): void {
    const openChanged = prevState.isOpen !== this.state.isOpen;
    if (openChanged) {
      if (this.state.isOpen) {
        this.addPositionListeners();
      } else {
        this.removePositionListeners();
        this.setState({ searchValue: '' });
        this.props.onSearchChange?.('');
      }
    } else if (this.state.isOpen && prevState.searchValue !== this.state.searchValue) {
      // Filtered option count may have changed while open — reposition.
      this.updatePosition();
    }
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  render(): React.ReactNode {
    const {
      value,
      onChange,
      options,
      placeholder = 'Select an option...',
      disabled = false,
      theme = 'light',
      className = '',
      triggerClassName = '',
      label,
      searchable = true,
      size = 'md',
      onSearchChange,
      clearable = false,
    } = this.props;
    const { isOpen, searchValue, coords } = this.state;
    const setIsOpen = (next: boolean) => this.setState({ isOpen: next });
    const setSearchValue = (next: string) => this.setState({ searchValue: next });
    const isDarkTheme = theme === 'dark';
  const triggerThemeClasses = isDarkTheme
    ? '!bg-slate-900/60 !border-slate-800 !text-white caret-white placeholder:text-slate-600 hover:!border-indigo-500/50 focus:!border-indigo-500 focus:!ring-0 [color-scheme:dark] autofill:[-webkit-text-fill-color:#ffffff] autofill:caret-white autofill:shadow-[inset_0_0_0px_1000px_rgba(15,23,42,0.96)]'
    : '';
  const emptyLabelThemeClasses = isDarkTheme ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium';
  const chevronThemeClasses = isDarkTheme ? 'text-slate-500' : 'text-slate-400';
  const searchInputThemeClasses = isDarkTheme
    ? '!bg-slate-900/60 !border-slate-800 !text-white caret-white placeholder:text-slate-600 hover:!border-indigo-500/50 focus:!border-indigo-500 focus:!ring-0 [color-scheme:dark]'
    : '';

  const selectedOption = options.find(opt => {
    // Ensure both are treated as strings for stable comparison
    const optVal = opt.value && typeof opt.value === 'object' ? (opt.value as any).value || (opt.value as any).id || (opt.value as any).slug : String(opt.value);
    const curVal = value && typeof value === 'object' ? (value as any).value || (value as any).id || (value as any).slug : String(value);
    return optVal === curVal;
  });
  const canClear = clearable && Boolean(selectedOption) && !disabled;

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

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && <label className={UiFieldUtils.TEXT.LABEL}>{label}</label>}
      <div className="relative w-full" ref={this.triggerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`${UiFieldUtils.getFieldClasses(size, `flex items-center text-left group overflow-hidden relative ${triggerClassName}`)} ${triggerThemeClasses} ${isOpen ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`relative z-10 min-w-0 flex-1 truncate ${!selectedOption ? emptyLabelThemeClasses : ''}`}>
             <div className="flex flex-col leading-none">
                {selectedOption ? (
                  <span className="truncate">{selectedOption.label}</span>
                ) : (
                  <span className="truncate">{placeholder ?? ''}</span>
                )}
             </div>
          </span>

          <span className="relative z-10 ml-2 flex flex-shrink-0 items-center gap-1">
            {canClear ? (
              <button
                type="button"
                aria-label="Clear selection"
                title="Clear selection"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange('');
                  setSearchValue('');
                  onSearchChange?.('');
                  setIsOpen(false);
                }}
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold leading-none transition-colors ${
                  isDarkTheme
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                x
              </button>
            ) : null}
            <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : chevronThemeClasses}`}>
              <FrameworkIcons.Down size={14} />
            </span>
          </span>

          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/[0.03] to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
        </button>

        {isOpen && (
          <RootFramework>
            <div
              ref={this.menuRef}
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
                      ref={this.searchInputRef}
                      type="text"
                      placeholder="Search options..."
                      value={searchValue}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setSearchValue(nextValue);
                        onSearchChange?.(nextValue);
                      }}
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
  }
}
