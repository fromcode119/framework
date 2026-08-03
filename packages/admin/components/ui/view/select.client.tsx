import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, ref, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import { SelectUtils } from '@/components/ui/select-utils';
import { SelectMenu } from '@/components/ui/view/select-menu.client';
import type { IOption } from '@/components/ui/interfaces/option.interface';

export class Select extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<Select, 'value' | 'onChange' | 'options' | 'placeholder' | 'disabled' | 'theme' | 'className' | 'triggerClassName' | 'label' | 'searchable' | 'size' | 'onSearchChange' | 'clearable'>;

  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare options: IOption[];
  @prop declare placeholder?: string;
  @prop declare disabled?: boolean;
  @prop declare theme?: ThemeMode;
  @prop declare className?: string;
  @prop declare triggerClassName?: string;
  @prop declare label?: string;
  @prop declare searchable?: boolean;
  @prop declare size?: FieldSize;
  @prop declare onSearchChange?: (value: string) => void;
  @prop declare clearable?: boolean;

  @ref declare triggerRef: Ref<HTMLDivElement>;
  @ref declare menuRef: Ref<HTMLDivElement>;
  @ref declare searchInputRef: Ref<HTMLInputElement>;

  @state isOpen = false;
  @state searchValue = '';
  @state coords: { top: number; left: number; width: number } = { top: 0, left: 0, width: 0 };

  private getFilteredOptions() {
    return SelectUtils.filter(this.options, this.searchValue);
  }

  @bound updatePosition(): void {
    if (this.triggerRef.current) {
      const rect = this.triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const filteredCount = this.getFilteredOptions().length;
      const menuHeight = Math.min(filteredCount * 48 + (this.searchable !== false ? 100 : 40), 300);

      let top = rect.bottom + margin;
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - margin;
      }

      this.coords = { top, left: rect.left, width: rect.width };
    }
  }

  @bound handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    if (
      this.triggerRef.current && !this.triggerRef.current.contains(target) &&
      this.menuRef.current && !this.menuRef.current.contains(target)
    ) {
      this.isOpen = false;
    }
  }

  private addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
    if (this.searchable !== false) {
      setTimeout(() => this.searchInputRef.current?.focus(), 50);
    }
  }

  private removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.isOpen) this.addPositionListeners();
  }

  @watch('isOpen') onOpenChange(next: boolean): void {
    if (next) {
      this.addPositionListeners();
    } else {
      this.removePositionListeners();
      this.searchValue = '';
      this.onSearchChange?.('');
    }
  }

  @watch('searchValue') onSearchValueChange(): void {
    // Filtered option count may have changed while open — reposition.
    if (this.isOpen) this.updatePosition();
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  render(): ReactNode {
    const { value, onChange, options, label, onSearchChange } = this;
    const placeholder = this.placeholder ?? 'Select an option...';
    const disabled = this.disabled ?? false;
    const theme = this.theme ?? ThemeMode.LIGHT;
    const className = this.className ?? '';
    const triggerClassName = this.triggerClassName ?? '';
    const searchable = this.searchable ?? true;
    const size = this.size ?? FieldSize.MD;
    const clearable = this.clearable ?? false;
    const { isOpen, searchValue, coords } = this;
    const setIsOpen = (next: boolean) => { this.isOpen = next; };
    const setSearchValue = (next: string) => { this.searchValue = next; };
    const isDarkTheme = theme === ThemeMode.DARK;
    const triggerThemeClasses = isDarkTheme
      ? '!bg-slate-900/60 !border-slate-800 !text-white caret-white placeholder:text-slate-600 hover:!border-indigo-500/50 focus:!border-indigo-500 focus:!ring-0 [color-scheme:dark] autofill:[-webkit-text-fill-color:#ffffff] autofill:caret-white autofill:shadow-[inset_0_0_0px_1000px_rgba(15,23,42,0.96)]'
      : '';
    const emptyLabelThemeClasses = isDarkTheme ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium';
    const chevronThemeClasses = isDarkTheme ? 'text-slate-500' : 'text-slate-400';

    const selectedOption = SelectUtils.findSelected(options, value);
    const canClear = clearable && Boolean(selectedOption) && !disabled;

    const filteredOptions = SelectUtils.filter(options, searchValue);
    const groupedFilteredOptions = SelectUtils.group(filteredOptions);
    const showGroupHeaders = SelectUtils.showGroupHeaders(groupedFilteredOptions);

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
          <SelectMenu
            theme={theme}
            searchable={searchable}
            searchValue={searchValue}
            coords={coords}
            filteredOptions={filteredOptions}
            groupedFilteredOptions={groupedFilteredOptions}
            showGroupHeaders={showGroupHeaders}
            selectedOption={selectedOption}
            menuRef={this.menuRef}
            searchInputRef={this.searchInputRef}
            onSearchChange={(next) => {
              setSearchValue(next);
              onSearchChange?.(next);
            }}
            onSelect={(finalVal) => {
              onChange(finalVal);
              setIsOpen(false);
            }}
          />
        )}
      </div>
    </div>
    );
  }
}
