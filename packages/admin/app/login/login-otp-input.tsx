import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';

/**
 * A six-digit authenticator code as six boxes. Typing moves forward, Backspace on an empty box moves
 * back, and pasting the whole code fills every box at once — the code is ONE value (`value`), the boxes
 * only show it. The first box carries `autocomplete="one-time-code"` so a phone can offer the code.
 */
export class LoginOtpInput extends PureReactor {
  declare props: Pick<LoginOtpInput, 'value' | 'onChange' | 'label' | 'invalid'>;

  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  /** The accessible name of the group (the visible heading says the same). */
  @prop declare label: string;
  @prop declare invalid?: boolean;

  private static readonly LENGTH = 6;
  private readonly boxes: Array<Input | null> = [];

  /**
   * What the visitor put into one box: a whole code when the phone autofilled it, otherwise the last
   * character typed (a box that already held a digit receives the old one plus the new one).
   */
  private static typed(raw: string): string {
    return raw.length > 2 ? raw : raw.slice(-1);
  }

  private focus(index: number): void {
    this.boxes[Math.max(0, Math.min(LoginOtpInput.LENGTH - 1, index))]?.focus();
  }

  private write(index: number, typed: string): void {
    const digits = typed.replace(/\D/g, '');
    const chars = this.value.padEnd(LoginOtpInput.LENGTH, ' ').split('');
    if (!digits) {
      chars[index] = ' ';
    } else {
      for (let i = 0; i < digits.length && index + i < LoginOtpInput.LENGTH; i += 1) chars[index + i] = digits[i];
    }
    this.onChange(chars.join('').replace(/\s+$/, '').replace(/\s/g, ''));
    if (digits) this.focus(index + digits.length);
  }

  private handleKey(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && !this.value[index]) {
      event.preventDefault();
      this.write(index - 1, '');
      this.focus(index - 1);
    } else if (event.key === 'ArrowLeft') {
      this.focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      this.focus(index + 1);
    }
  }

  private handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    this.write(index, event.clipboardData.getData('text'));
  }

  render(): ReactNode {
    const slots = Array.from({ length: LoginOtpInput.LENGTH }, (_, i) => this.value[i] || '');
    return (
      <div className={`fc-login__otp${this.invalid ? ' is-invalid' : ''}`} role="group" aria-label={this.label}>
        {slots.map((digit, index) => (
          <Input
            key={index}
            ref={(el: Input | null) => { this.boxes[index] = el; }}
            inputClassName={`text-center font-semibold${this.invalid ? ' !border-rose-500' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={LoginOtpInput.LENGTH}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            autoFocus={index === 0}
            aria-label={`${this.label} ${index + 1}`}
            value={digit}
            onChange={(event) => this.write(index, LoginOtpInput.typed(event.target.value))}
            onKeyDown={(event) => this.handleKey(index, event)}
            onPaste={(event) => this.handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
    );
  }
}
