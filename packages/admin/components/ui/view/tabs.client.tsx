import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * Several views of one thing, one shown at a time: the row of names that chooses between them.
 *
 * The caller holds which one is on (`value`) and draws the chosen view itself — this is only the row,
 * so the same control heads a card, a dialog or a page. Left and right move the choice, as a row of
 * tabs is expected to; a disabled one is skipped. The look is `admin.css` (`fc-tabs`, `fc-tab`).
 */
export class Tabs extends PureReactor {
  /** `count` prints a number after the name; `icon` a glyph before it; `end` starts the tabs that stand at the far end of the row. */
  @prop declare tabs: Array<{ id: string; label: ReactNode; disabled?: boolean; count?: number; icon?: ReactNode; end?: boolean }>;
  /** `bar` heads a page, with a line under it; `second` is the level under a bar. More tabs than fit go to a second line. */
  @prop declare variant?: 'bar' | 'second';
  @prop declare value: string;
  @prop declare onChange: (id: string) => void;
  @prop declare className?: string;
  /** What the row is a choice of, for a screen reader. */
  @prop declare label?: string;

  @bound private onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const usable = this.tabs.filter((tab) => !tab.disabled);
    const at = usable.findIndex((tab) => tab.id === this.value);
    if (at < 0 || usable.length < 2) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = usable[(at + step + usable.length) % usable.length];
    this.onChange(next.id);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)');
    buttons[(at + step + usable.length) % usable.length]?.focus();
  }

  render(): ReactNode {
    const tab = AdminClass.of('tab');
    return (
      <div className={`${AdminClass.of('tabs')}${this.variant ? ` ${AdminClass.of('tabbar')}` : ''}${this.variant === 'second' ? ` ${AdminClass.of('tabbar--second')}` : ''} ${this.className ?? ''}`} role="tablist" aria-label={this.label} onKeyDown={this.onKeyDown}>
        {this.tabs.map((item) => {
          const on = item.id === this.value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              disabled={item.disabled}
              className={`${tab}${on ? ` ${tab}--on` : ''}${item.end ? ` ${tab}--end` : ''}`}
              onClick={() => this.onChange(item.id)}
            >
              {item.icon}
              {item.label}
              {item.count === undefined ? null : <span className={`${tab}__count`}>{item.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }
}
