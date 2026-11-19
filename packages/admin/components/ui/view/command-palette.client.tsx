import { Kbd } from '@/components/ui/view/kbd.client';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PureReactor, prop, state, bound, watch } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * The big search: one field in the middle of the window and, under it, what matches — opened by a key
 * from anywhere, walked with the arrows, chosen with Enter, left with Escape.
 *
 * It only draws and moves the choice. The caller holds what is typed (`query`), decides what matches
 * (`items`) and what choosing one does, so the same window searches pages here and anything else
 * somewhere else.
 */
export class CommandPalette extends PureReactor {
  @prop declare open: boolean;
  @prop declare onClose: () => void;
  @prop declare query: string;
  @prop declare onQuery: (query: string) => void;
  @prop declare items: Array<{ id: string; label: ReactNode; icon?: ReactNode; hint?: ReactNode; onSelect: () => void }>;
  @prop declare placeholder?: string;
  /** What is said when nothing matches. */
  @prop declare empty?: ReactNode;

  @state private active = 0;

  /** A new list starts from its first row: the row that was third in the old one means nothing in this one. */
  @watch('query') protected onQueryChanged(): void {
    this.active = 0;
  }

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.onQuery(event.target.value);
  }

  @bound private key(event: KeyboardEvent<HTMLDivElement>): void {
    const count = this.items.length;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    } else if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active = (this.active + 1) % count;
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active = (this.active - 1 + count) % count;
    } else if (event.key === 'Enter' && this.items[this.active]) {
      event.preventDefault();
      this.items[this.active].onSelect();
    }
  }

  render(): ReactNode {
    if (!this.open || typeof document === 'undefined') return null;
    const name = AdminClass.of('palette');
    return createPortal(
      <div className={name} onKeyDown={this.key}>
        <div className={`${name}__backdrop`} onClick={this.onClose} />
        <div className={`${name}__panel`} role="dialog" aria-modal="true" aria-label={this.placeholder}>
          <div className={`${name}__head`}>
            <FrameworkIcons.Search size={15} className={`${name}__icon`} />
            <input autoFocus type="text" className={`${name}__input`} value={this.query} onChange={this.change} placeholder={this.placeholder} aria-label={this.placeholder} />
            <Kbd>esc</Kbd>
          </div>
          <div className={`${name}__list`} role="listbox">
            {this.items.length
              ? this.items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={index === this.active}
                    className={`${name}__item`}
                    onMouseEnter={() => { this.active = index; }}
                    onClick={item.onSelect}
                  >
                    {item.icon ? <span className={`${name}__item-icon`}>{item.icon}</span> : null}
                    <span className={`${name}__item-label`}>{item.label}</span>
                    {item.hint ? <span className={`${name}__item-hint`}>{item.hint}</span> : null}
                  </button>
                ))
              : <div className={`${name}__empty`}><FrameworkIcons.Search size={15} />{this.empty}</div>}
          </div>
          <div className={`${name}__foot`}>
            <Kbd>↓</Kbd>
            <Kbd>↑</Kbd>
            <span className={`${name}__rule`} />
            <Kbd>↵</Kbd>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
}
