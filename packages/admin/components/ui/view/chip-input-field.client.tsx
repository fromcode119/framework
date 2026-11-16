import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A list of short values, written as chips: the sizes a product comes in, its tags, the labels of a
 * choice. Type one and press Enter or comma; press Backspace on an empty box to take the last one off.
 *
 * It exists because the console had no control for "several short values" and reached for a form
 * instead. Adding one size meant a button that opened a bordered sub-form with its own fields and its
 * own Cancel — so a dialog ended up with two Cancel buttons of different sizes, and a reader counting
 * four sizes had to open four forms to see them. Every console worth copying takes this with one box:
 * the values stand in it as chips, and the next one is typed where the cursor already is.
 *
 * Declared by a field as `admin.component: 'ChipInputField'`; it answers for any field whose value is
 * an array of short strings, in any plugin, with nothing plugin-specific in here.
 */
export class ChipInputField extends PureReactor {
  @prop declare value: unknown;
  @prop declare onChange: (next: string[]) => void;
  @prop declare disabled?: boolean;
  @prop declare field?: { admin?: { placeholder?: string } };

  @state private draft = '';

  /** Only strings make chips: anything else in the stored value is left exactly as it was found. */
  private get chips(): string[] {
    return Array.isArray(this.value) ? this.value.filter((entry) => typeof entry === 'string') : [];
  }

  private commit(text: string): void {
    const chip = text.trim();
    // The same value twice is not two things, and an empty one is not a thing at all.
    if (!chip || this.chips.includes(chip)) return;
    this.onChange([...this.chips, chip]);
  }

  @bound private onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter inside a dialog submits the form; a value being typed is not a form being finished.
      event.preventDefault();
      this.commit(this.draft);
      this.draft = '';
      return;
    }
    if (event.key === 'Backspace' && !this.draft && this.chips.length) {
      this.onChange(this.chips.slice(0, -1));
    }
  }

  /** Leaving the box keeps what was typed: a half-typed value that vanishes on a click is a loss. */
  @bound private onBlur(): void {
    if (!this.draft.trim()) return;
    this.commit(this.draft);
    this.draft = '';
  }

  @bound private onInput(event: { target: { value: string } }): void {
    this.draft = event.target.value;
  }

  private remove(chip: string): void {
    this.onChange(this.chips.filter((entry) => entry !== chip));
  }

  render(): ReactNode {
    const chips = this.chips;
    return (
      <div className={`fc-chip-input${this.disabled ? ' fc-chip-input--locked' : ''}`}>
        {chips.map((chip) => (
          <span key={chip} className="fc-chip fc-chip--removable">
            {chip}
            {this.disabled ? null : (
              <button
                type="button"
                className="fc-chip__remove"
                aria-label={AdminI18n.t('fields.chipInput.remove', { value: chip })}
                onClick={() => this.remove(chip)}
              >
                <FrameworkIcons.X size={11} />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          className="fc-chip-input__entry"
          value={this.draft}
          disabled={this.disabled}
          placeholder={chips.length ? '' : (this.field?.admin?.placeholder || AdminI18n.t('fields.chipInput.placeholder'))}
          onChange={this.onInput}
          onKeyDown={this.onKeyDown}
          onBlur={this.onBlur}
        />
      </div>
    );
  }
}
