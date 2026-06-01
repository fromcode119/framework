"use client";

import React from 'react';
import { LocalizedField } from '@/components/ui/localized-field';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import type { LocalizedTextFieldProps } from './localized-text-field.interfaces';

/**
 * Built-in translation-aware text field for the collection editor. Wraps {@link LocalizedField}
 * (locale switcher) around an {@link Input} (or {@link TextArea} when `multiline`), storing a
 * per-locale value object. Wired in field-renderer for `admin.component:'LocalizedText'` /
 * `'LocalizedTextarea'`. Legacy plain-string values are shown as a fallback until edited.
 */
export class LocalizedTextField extends React.Component<LocalizedTextFieldProps> {
  private getMap(): Record<string, string> {
    const { value } = this.props;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>;
    return {};
  }

  render(): React.ReactNode {
    const { onChange, field, multiline, disabled, value } = this.props;
    const map = this.getMap();
    const stringFallback = typeof value === 'string' ? value : '';

    return (
      <LocalizedField
        label={String(field?.label || field?.name || '')}
        input={(locale) => {
          const current = map[locale] ?? stringFallback;
          const update = (next: string): void => onChange({ ...map, [locale]: next });
          return multiline
            ? <TextArea value={current} disabled={disabled} onChange={(e) => update(e.target.value)} />
            : <Input value={current} disabled={disabled} onChange={(e) => update(e.target.value)} />;
        }}
      />
    );
  }
}
