import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A small panel that opens from a control and holds content of its own — a few fields, a filter, a
 * note with an action. It closes on a press outside it and on Esc. For a list of actions use Dropdown;
 * for a few words on hover use Tooltip.
 */
export class Popover extends PureReactor {
  /** What opens it. */
  @prop declare trigger: ReactNode;
  @prop declare children: ReactNode;
  @prop declare align?: 'start' | 'end';
  @prop declare side?: 'bottom' | 'top';
  /** A name for the panel, read out when it opens. */
  @prop declare label?: string;
  @prop declare className?: string;

  @state private open = false;
  private root = this.ref<HTMLSpanElement>();

  componentWillUnmount(): void {
    this.hear(false);
  }

  /** Hears a press outside the panel and Esc — only while the panel is open. */
  private hear(on: boolean): void {
    if (!Platform.isBrowser) return;
    if (on) {
      document.addEventListener('mousedown', this.onOutside);
      document.addEventListener('keydown', this.onKey);
      return;
    }
    document.removeEventListener('mousedown', this.onOutside);
    document.removeEventListener('keydown', this.onKey);
  }

  @bound private toggle(): void {
    this.open = !this.open;
    this.hear(this.open);
  }

  @bound private close(): void {
    this.open = false;
    this.hear(false);
  }

  @bound private onOutside(event: MouseEvent): void {
    if (this.root.current && !this.root.current.contains(event.target as Node)) this.close();
  }

  @bound private onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  render(): ReactNode {
    const name = AdminClass.of('popover');
    return (
      <span ref={this.root} className={`${name} ${this.className ?? ''}`}>
        <button type="button" className={`${name}__trigger`} aria-haspopup="dialog" aria-expanded={this.open} onClick={this.toggle}>{this.trigger}</button>
        {this.open ? (
          <div role="dialog" aria-label={this.label} className={`${name}__panel`} data-align={this.align ?? 'start'} data-side={this.side ?? 'bottom'}>{this.children}</div>
        ) : null}
      </span>
    );
  }
}
