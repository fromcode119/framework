"use client";

import React from 'react';
import { Input } from '@/components/ui/input';

interface PermalinkValue {
  custom?: string;
  disabled?: boolean;
}

interface PermalinkFieldProps {
  value: PermalinkValue | null | undefined;
  onChange: (value: PermalinkValue) => void;
  theme?: string;
  disabled?: boolean;
}

export const PermalinkField: React.FC<PermalinkFieldProps> = ({
  value,
  onChange,
  theme = 'light',
  disabled = false,
}) => {
  const custom = typeof value?.custom === 'string' ? value.custom : '';
  const isDisabled = Boolean(value?.disabled);

  const update = (patch: Partial<PermalinkValue>) => {
    onChange({ custom, disabled: isDisabled, ...patch });
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={custom}
        onChange={(e) => update({ custom: e.target.value })}
        placeholder="/custom-url"
        disabled={disabled}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={isDisabled}
        onClick={() => !disabled && update({ disabled: !isDisabled })}
        disabled={disabled}
        className={`flex items-center gap-2.5 w-full text-left select-none text-[12px] font-semibold transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
      >
        <div
          className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${
            isDisabled
              ? 'bg-rose-500'
              : theme === 'dark'
                ? 'bg-slate-700'
                : 'bg-slate-200'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              isDisabled ? 'left-[calc(100%-14px-2px)]' : 'left-0.5'
            }`}
          />
        </div>
        Disable public URL
      </button>
    </div>
  );
};
