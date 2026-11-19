import type { ClipboardEvent, KeyboardEvent, ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A short code typed a character a box: the code from an authenticator or a message. Typing moves to
 * the next box, Backspace to the one before, and a pasted code fills them all.
 */
export class OtpInput extends PureReactor {
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  /** How many characters the code has. */
  @prop declare length?: number;
  /** A dash after every this many boxes: 3 gives 123 – 456. */
  @prop declare groupSize?: number;
  @prop declare invalid?: boolean;
  @prop declare disabled?: boolean;
  @prop declare autoFocus?: boolean;
  /** What the code is, for a screen reader. */
  @prop declare label?: string;

  private boxes: Array<HTMLInputElement | null> = [];

  private get size(): number {
    return this.length ?? 6;
  }

  private focus(index: number): void {
    this.boxes[Math.max(0, Math.min(this.size - 1, index))]?.focus();
  }

  private put(index: number, text: string): void {
    const chars = String(this.value ?? '').padEnd(this.size, ' ').split('');
    text.split('').forEach((char, offset) => { if (index + offset < this.size) chars[index + offset] = char; });
    this.onChange(chars.join('').replace(/\s+$/, ''));
  }

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    const index = Number(event.target.dataset.index);
    const typed = event.target.value.replace(/\s/g, '').slice(-1);
    if (!typed) return;
    this.put(index, typed);
    this.focus(index + 1);
  }

  @bound private key(event: KeyboardEvent<HTMLInputElement>): void {
    const index = Number(event.currentTarget.dataset.index);
    if (event.key === 'Backspace') {
      event.preventDefault();
      const filled = Boolean(String(this.value ?? '')[index]?.trim());
      this.put(filled ? index : index - 1, ' ');
      if (!filled) this.focus(index - 1);
    }
    if (event.key === 'ArrowLeft') this.focus(index - 1);
    if (event.key === 'ArrowRight') this.focus(index + 1);
  }

  @bound private paste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    const text = event.clipboardData.getData('text').replace(/\s/g, '').slice(0, this.size);
    this.put(0, text.padEnd(this.size, ' '));
    this.focus(text.length);
  }

  render(): ReactNode {
    const name = AdminClass.of('otp');
    const group = this.groupSize ?? 0;
    const value = String(this.value ?? '');
    return (
      <div className={`${name}${this.invalid ? ` ${name}--invalid` : ''}`} role="group" aria-label={this.label}>
        {Array.from({ length: this.size }).map((_, index) => (
          <span key={index} className={`${name}__slot`}>
            {group && index > 0 && index % group === 0 ? <span className={`${name}__gap`} aria-hidden="true">–</span> : null}
            <input
              ref={(element) => { this.boxes[index] = element; }}
              data-index={index}
              className={`${name}__box`}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={this.autoFocus && index === 0}
              disabled={this.disabled}
              aria-invalid={this.invalid || undefined}
              aria-label={`${this.label ?? ''} ${index + 1}`.trim()}
              value={value[index]?.trim() ?? ''}
              onChange={this.change}
              onKeyDown={this.key}
              onPaste={this.paste}
            />
          </span>
        ))}
      </div>
    );
  }
}
