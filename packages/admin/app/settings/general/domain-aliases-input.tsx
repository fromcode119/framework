"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DomainAliasesInputProps {
  value: string[];
  onChange: (aliases: string[]) => void;
  theme?: string;
}

interface DomainAliasesInputState {
  draft: string;
}

export class DomainAliasesInput extends React.Component<DomainAliasesInputProps, DomainAliasesInputState> {
  private readonly inputRef = React.createRef<HTMLInputElement>();
  state: DomainAliasesInputState = { draft: '' };

  private addAlias = (): void => {
    const { value, onChange } = this.props;
    const trimmed = this.state.draft.trim().toLowerCase().replace(/\/+$/, '');
    if (!trimmed || value.includes(trimmed)) {
      this.setState({ draft: '' });
      return;
    }
    onChange([...value, trimmed]);
    this.setState({ draft: '' });
    this.inputRef.current?.focus();
  };

  private removeAlias = (alias: string): void => {
    const { value, onChange } = this.props;
    onChange(value.filter((a) => a !== alias));
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addAlias();
    }
  };

  render(): React.ReactNode {
    const { value, theme = 'light' } = this.props;
    const { draft } = this.state;
    const isDark = theme === 'dark';

    return (
    <div className="flex flex-col gap-3 w-full md:w-96">
      <div className="flex gap-2">
        <Input
          ref={this.inputRef}
          value={draft}
          onChange={(e) => this.setState({ draft: e.target.value })}
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
                onClick={() => this.removeAlias(alias)}
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
