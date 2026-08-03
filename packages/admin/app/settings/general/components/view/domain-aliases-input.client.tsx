import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, ref } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';

export class DomainAliasesInput extends Reactor {
  @prop declare value: string[];
  @prop declare onChange: (aliases: string[]) => void;
  @prop declare theme?: ThemeMode;

  @state draft = '';

  /** `ref` on a class component yields the instance — Input exposes its own focus(). */
  @ref declare inputRef: Ref<Input>;

  private get isDark(): boolean {
    return (this.theme ?? ThemeMode.LIGHT) === ThemeMode.DARK;
  }

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
    const isDark = this.isDark;

    return (
    <div className="flex flex-col gap-3 w-full md:w-96">
      <div className="flex gap-2">
        <Input
          ref={this.inputRef}
          value={draft}
          onChange={this.handleDraftChange}
          onKeyDown={this.handleKeyDown}
          placeholder="https://alias.example.com"
          className="flex-1 font-bold"
        />
        <Button
          onClick={this.addAlias}
          disabled={!draft.trim()}
          icon={<FrameworkIcons.Plus size={13} strokeWidth={3} />}
          className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
        >
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((alias) => (
            <span
              key={alias}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-tight ${
                isDark
                  ? 'bg-slate-800 text-slate-200 border border-slate-700'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <FrameworkIcons.Globe size={11} className="opacity-50" />
              {alias}
              <button
                data-alias={alias}
                onClick={this.handleRemoveClick}
                className={`ml-0.5 rounded transition-colors ${
                  isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'
                }`}
              >
                <FrameworkIcons.X size={11} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
    );
  }
}
