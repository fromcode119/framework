import type { Ref } from '@fromcode119/react-class-components';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RootFramework } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import { SelectUtils } from '@/components/ui/select-utils';
import type { IOption } from '@/components/ui/interfaces/option.interface';
import type { ISelectOptionGroup } from '@/components/ui/interfaces/select-option-group.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class SelectMenu extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<SelectMenu, 'theme' | 'searchable' | 'searchValue' | 'coords' | 'filteredOptions' | 'groupedFilteredOptions' | 'showGroupHeaders' | 'selectedOption' | 'menuRef' | 'searchInputRef' | 'onSearchChange' | 'onSelect' | 'onCreate' | 'createLabel' | 'onDelete' | 'menuNote' | 'searching'>;

  @prop declare theme: ThemeMode;
  @prop declare searchable: boolean;
  @prop declare searchValue: string;
  /** Either `top` (opens downward) or `bottom` (opens upward, anchored to the trigger) is set — never both. */
  @prop declare coords: { top?: number; bottom?: number; left: number; width: number };
  @prop declare filteredOptions: IOption[];
  /** One line under the list, supplied by the owner — an honest cap, or where the list came from. */
  @prop declare menuNote?: string;
  /** The owner is fetching the answer to what was typed; the list is not the catalogue yet. */
  @prop declare searching?: boolean;
  @prop declare groupedFilteredOptions: ISelectOptionGroup[];
  @prop declare showGroupHeaders: boolean;
  @prop declare selectedOption?: IOption;
  @prop declare menuRef: Ref<HTMLDivElement>;
  @prop declare searchInputRef: Ref<HTMLInputElement>;
  @prop declare onSearchChange: (value: string) => void;
  @prop declare onSelect: (value: string) => void;
  /** Present only when the caller allows creating an option; receives the typed text. */
  @prop declare onCreate?: (label: string) => void;
  /** Present only when the caller allows deleting its deletable options; receives the option value. */
  @prop declare onDelete?: (value: string) => void;
  /** Caller-supplied wording for the create row, e.g. `Add "Кръстник"`. */
  @prop declare createLabel?: string;

  /**
   * The typed text is offered as a new option only when it is non-empty and no visible option already
   * carries it. Matching on the LABEL (not the value) is deliberate: the user is typing what they want to
   * see, and offering to create a duplicate of something already in the list is how duplicate catalog
   * entries get made.
   */
  private get canCreate(): boolean {
    if (!this.onCreate) return false;
    const typed = this.searchValue.trim().toLowerCase();
    if (!typed) return false;
    return !this.filteredOptions.some((option) => String(option.label ?? '').trim().toLowerCase() === typed);
  }

  render(): React.ReactNode {
    const {
      searchable, searchValue, coords, filteredOptions, groupedFilteredOptions,
      showGroupHeaders, selectedOption, menuRef, searchInputRef, onSearchChange, onSelect, onCreate,
      menuNote, searching,
    } = this;
    const canCreate = this.canCreate;

    return (
          <RootFramework>
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                ...(coords.top !== undefined ? { top: coords.top } : { bottom: coords.bottom }),
                left: coords.left,
                width: coords.width,
                // Above the modal layer (dialogs sit at 2147483000): at 9999 a select inside a dialog — the
                // Sources form's Provider, Branch and Type — opened its list BEHIND the dialog, unpickable.
                zIndex: 2147483600
              }}
              // The sheet every menu in this console opens in. It used to be its own object: a 12px
              // corner, a blurred translucent pane and shadow-2xl, so the list a field opened looked
              // nothing like the list the card's menu opened two rows above it.
              className="fc-menu-sheet max-h-[300px] flex flex-col overflow-hidden"
            >
              {searchable && (
                <div className="p-1 pb-2 border-b fc-tone-line">
                  <div className="fc-search">
                    <div className="fc-search__icon">
                      <FrameworkIcons.Search size={15} />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={AdminI18n.t('ui.select.search')}
                      value={searchValue}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className={UiFieldUtils.getFieldClasses(FieldSize.SM, 'fc-search-field')}
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => onCreate?.(searchValue.trim())}
                    className="fc-menu-action"
                  >
                    <FrameworkIcons.Plus size={15} className="fc-menu-action__icon" />
                    <span className="truncate">{this.createLabel ?? AdminI18n.t('ui.select.create', { value: searchValue.trim() })}</span>
                  </button>
                )}
                {filteredOptions.length === 0 ? (
                  canCreate && !searching ? null : (
                  <div className="px-4 py-8 text-center">
                    {/* An empty list while the owner is still searching is not an empty catalogue: saying
                        "no results" there is a wrong answer the operator cannot tell from a right one. */}
                    <p className="text-[length:var(--fc-control-text)] leading-5 fc-tone-muted">
                      {AdminI18n.t(searching ? 'ui.select.searching' : 'ui.select.noResults')}
                    </p>
                  </div>
                  )
                ) : (
                  groupedFilteredOptions.map((group) => {
                    const sections = SelectUtils.sections(group.options);
                    const showSectionHeaders = SelectUtils.showSectionHeaders(sections);

                    return (
                    <div key={group.name} className="mb-0.5 last:mb-0">
                      {showGroupHeaders && (
                        <div className="px-2 pt-2 pb-1 fc-size-xs font-medium fc-tone-muted">
                          {group.name === 'Options' ? AdminI18n.t('ui.select.options') : group.name}
                        </div>
                      )}
                      {sections.map((section) => (
                        <div key={`${group.name}:${section.name || 'default'}`}>
                          {showSectionHeaders && section.name ? (
                            <div className="px-3 pt-1 pb-1 fc-size-xs font-medium fc-tone-muted">
                              {section.name}
                            </div>
                          ) : null}
                          {section.options.map((opt) => (
                        <button
                          key={`${group.name}:${section.name}:${typeof opt.value === 'object' ? JSON.stringify(opt.value) : opt.value}:${opt.label}`}
                          type="button"
                          onClick={() => onSelect(SelectUtils.normalizeValue(opt.value))}
                          aria-current={selectedOption && selectedOption === opt ? 'true' : undefined}
                          className={`fc-menu-action justify-between group ${section.name ? 'ps-6' : ''}`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {opt.label}
                          </span>
                          {(selectedOption && selectedOption === opt) ? (
                            <FrameworkIcons.Check size={15} className="fc-menu-action__icon" />
                          ) : this.onDelete && opt.deletable ? (
                            <span
                              role="button"
                              aria-label={AdminI18n.t('ui.select.removeOption')}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                this.onDelete?.(SelectUtils.normalizeValue(opt.value));
                              }}
                              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity fc-tone-muted hover:text-[color:var(--fc-danger)]"
                            >
                              <FrameworkIcons.Trash size={13} />
                            </span>
                          ) : null}
                        </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )})
                )}
              </div>

              {menuNote ? (
                <div className="border-t fc-tone-line px-2 py-2 fc-size-xs font-medium fc-tone-muted">
                  {menuNote}
                </div>
              ) : null}
            </div>
          </RootFramework>
    );
  }
}
