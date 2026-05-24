"use client";

import React, { useState, useRef } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DomainAliasesInputProps {
  value: string[];
  onChange: (aliases: string[]) => void;
  theme?: string;
}

export const DomainAliasesInput: React.FC<DomainAliasesInputProps> = ({ value, onChange, theme = 'light' }) => {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';

  function addAlias() {
    const trimmed = draft.trim().toLowerCase().replace(/\/+$/, '');
    if (!trimmed || value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
    inputRef.current?.focus();
  }

  function removeAlias(alias: string) {
    onChange(value.filter((a) => a !== alias));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAlias();
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full md:w-96">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://alias.example.com"
          className="flex-1 font-bold"
        />
        <Button
          onClick={addAlias}
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
                onClick={() => removeAlias(alias)}
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
};
