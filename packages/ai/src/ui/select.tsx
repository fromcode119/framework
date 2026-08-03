import { HandlePosition } from '@ai/enums/handle-position.enum';
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, watch, ref, Platform, Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';

import type { SelectOption } from '@ai/ui/select-option';

/**
 * Searchable single-select with a portalled, viewport-clamped menu. Class-based (reactor): props via
 * `@prop`, reactive open/search/position via `@state`, outside-click + layout listeners auto-removed on
 * unmount via `this.listen`, and the menu rendered through `this.portal` — no hooks, no raw React.
 */
export class Select extends Reactor {
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare options: SelectOption[];
  @prop declare placeholder?: string;
  @prop declare disabled?: boolean;
  @prop declare className?: string;
  @prop declare searchable?: boolean;
  @prop declare menuPosition?: HandlePosition;
  @prop declare compact?: boolean;

  @state open = false;
  @state search = '';
  @state menuStyle: { left: number; top: number; width: number } | null = null;

  @ref private declare rootRef: Ref<HTMLDivElement>;
  @ref private declare triggerRef: Ref<HTMLButtonElement>;
  @ref private declare menuRef: Ref<HTMLDivElement>;

  // --- defaulted props (the function version's default parameter values) ---
  private get placeholderText(): string { return this.placeholder ?? 'Select...'; }
  private get isSearchable(): boolean { return this.searchable ?? true; }
  private get position(): HandlePosition { return this.menuPosition ?? HandlePosition.BOTTOM; }
  private get isCompact(): boolean { return this.compact ?? false; }
  private get css(): string { return this.className ?? ''; }

  // --- derived values (render reads these, never computes) ---
  private get selected(): SelectOption | null {
    return this.options.find((item) => item.value === this.value) ?? null;
  }

  private get filtered(): SelectOption[] {
    const keyword = this.search.trim().toLowerCase();
    if (!keyword) return this.options;
    return this.options.filter((item) => item.label.toLowerCase().includes(keyword));
  }

  componentDidMount(): void {
    this.listen(document, 'mousedown', this.onDocumentMouseDown);
    this.listen(window, 'resize', this.onLayout);
    this.listen(window, 'scroll', this.onLayout, { capture: true });
    if (this.open) this.updateMenuPosition();
  }

  componentDidUpdate(): void {
    // Re-measure after the menu (or a filter) changes; the guard in updateMenuPosition breaks the loop.
    if (this.open) this.updateMenuPosition();
  }

  @watch('open')
  protected onOpenChanged(open: boolean): void {
    if (!open) {
      this.search = '';
      this.menuStyle = null;
    }
  }

  @bound
  protected onToggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
  }

  @bound
  protected onDocumentMouseDown(event: Event): void {
    const target = event.target as Node;
    const insideRoot = !!this.rootRef.current?.contains(target);
    const insideMenu = !!this.menuRef.current?.contains(target);
    if (!insideRoot && !insideMenu) this.open = false;
  }

  @bound
  protected onLayout(): void {
    this.updateMenuPosition();
  }

  @bound
  protected onSearchInput(event: ChangeEvent<HTMLInputElement>): void {
    this.search = event.target.value;
  }

  @bound
  protected onOptionClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    this.onChange(event.currentTarget.dataset.value ?? '');
    this.open = false;
  }

  private updateMenuPosition(): void {
    const trigger = this.triggerRef.current;
    if (!this.open || !trigger || !Platform.isBrowser) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = this.menuRef.current?.offsetHeight || 280;
    const pad = 8;

    let top = this.position === HandlePosition.TOP ? rect.top - menuHeight - 6 : rect.bottom + 6;
    top = Math.max(pad, Math.min(top, window.innerHeight - menuHeight - pad));

    const next = { left: rect.left, top, width: rect.width };
    const cur = this.menuStyle;
    if (cur && cur.left === next.left && cur.top === next.top && cur.width === next.width) return;
    this.menuStyle = next;
  }

  private renderTrigger(): ReactNode {
    const size = this.isCompact ? 'h-8 rounded-xl px-2.5 text-[11px]' : 'h-11 rounded-xl px-3 text-sm';
    const tone = this.disabled
      ? 'cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--text-sub)] opacity-65'
      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-strong)]';
    const sel = this.selected;
    return (
      <button
        ref={this.triggerRef}
        type="button"
        disabled={this.disabled}
        onClick={this.onToggle}
        className={`${size} w-full border text-left transition inline-flex items-center justify-between gap-2 ${tone}`}
      >
        <span className={`truncate ${sel ? '' : 'text-[var(--text-sub)] opacity-80'}`}>
          {sel ? sel.label : this.placeholderText}
        </span>
        <span className={`shrink-0 transition-transform ${this.open ? 'rotate-180' : ''}`}>
          <FrameworkIcons.Down size={14} />
        </span>
      </button>
    );
  }

  private renderMenu(): ReactNode {
    const style = this.menuStyle;
    const list = this.filtered;
    return (
      <div
        ref={this.menuRef}
        style={style ? { left: style.left, top: style.top, width: style.width } : undefined}
        className={`fixed z-[9999] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--input-bg)] shadow-[0_16px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl ${
          style ? '' : 'opacity-0 pointer-events-none'
        }`}
      >
        {this.isSearchable ? (
          <div className="border-b border-[var(--border)] p-2">
            <input
              value={this.search}
              onChange={this.onSearchInput}
              placeholder="Search..."
              className={`${GlassMorphism.GLASS_INPUT} h-9 w-full px-2.5 text-xs`}
            />
          </div>
        ) : null}

        <div className="max-h-56 overflow-y-auto p-1">
          {list.length === 0 ? (
            <div className="px-2 py-2 text-xs text-[var(--text-sub)]">No options.</div>
          ) : (
            list.map((option) => (
              <button
                key={option.value}
                type="button"
                data-value={option.value}
                onClick={this.onOptionClick}
                className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs transition last:mb-0 ${
                  option.value === this.value
                    ? 'bg-[var(--surface-strong)] font-semibold text-[var(--text-main)]'
                    : 'text-[var(--text-main)]/90 hover:bg-[var(--surface)] hover:text-[var(--text-main)]'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div ref={this.rootRef} className={`relative ${this.css}`}>
        {this.renderTrigger()}
        {this.open ? this.portal(this.renderMenu()) : null}
      </div>
    );
  }
}
