"use client";

import React from 'react';
import { ContextHooks } from '@fromcode119/react';

export function ThemeStyleVariantSelect({
  value,
  onChange,
  includeAuto = true,
}: {
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
}) {
  const { themeStyleVariants } = ContextHooks.usePlugins();
  const options = [
    ...(includeAuto ? [{ value: 'auto', label: 'Auto' }] : []),
    ...Object.entries((themeStyleVariants as Record<string, any>) ?? {}).map(([key, v]) => ({
      value: key,
      label: (v as any).label ?? key,
    })),
  ];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
