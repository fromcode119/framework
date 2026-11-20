import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';

export class DomainAliasesInput extends Reactor {
  @prop declare value: string[];
  @prop declare onChange: (aliases: string[]) => void;
  @prop declare theme?: ThemeMode;
  /** Out of reach in this scope — the row it belongs to is not selected. Say so, never silently drop. */
  @prop declare disabled?: boolean;

  @state draft = '';

  /** `ref` on a class component yields the instance — Input exposes its own focus(). */
  @ref declare inputRef: Ref<Input>;


  @bound
  private addAlias(): void {
    const trimmed = this.draft.trim().toLowerCase().replace(/\/+$/, '');
    if (!trimmed || this.value.includes(trimmed)) {
      this.draft = '';
      return;
    }
    this.onChange([...this.value, trimmed]);
    this.draft = '';
    this.inputRef.current?.focus();
  }

  @bound
  private handleDraftChange(e: ChangeEvent<HTMLInputElement>): void {
    this.draft = e.target.value;
  }

  @bound
  private handleRemoveClick(e: MouseEvent<HTMLButtonElement>): void {
    const alias = e.currentTarget.dataset.alias ?? '';
    this.onChange(this.value.filter((a) => a !== alias));
  }

  @bound
  private handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addAlias();
    }
  }

  render(): ReactNode {
    const value = this.value;
    const draft = this.draft;

    return (
    <div className="flex flex-col gap-3 w-full md:w-96">
      <div className="flex gap-2">
        <Input
          ref={this.inputRef}
          value={draft}
          onChange={this.handleDraftChange}
          onKeyDown={this.handleKeyDown}
          placeholder="https://alias.example.com"
          disabled={this.disabled}
          className="flex-1"
        />
        <Button
          onClick={this.addAlias}
          disabled={this.disabled || !draft.trim()}
          icon={<FrameworkIcons.Plus size={13} strokeWidth={3} />}
          className="flex-shrink-0"
        >
          {AdminI18n.t('settings.general.add')}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((alias) => (
            <span
              key={alias}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fc-size-xs font-medium tracking-tight fc-tone-raised fc-tone-text border fc-tone-line`}
            >
              <FrameworkIcons.Globe size={11} className="opacity-50" />
              {alias}
              <Button
                type="button"
                variant={ButtonVariant.GHOST}
                className="fc-btn--glyph"
                data-alias={alias}
                aria-label={AdminI18n.t('common.remove')}
                onClick={this.handleRemoveClick}
                disabled={this.disabled}
              >
                <FrameworkIcons.X size={11} strokeWidth={3} />
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
    );
  }
}
