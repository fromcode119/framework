import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { LocalizedField } from '@/components/ui/view/localized-field.client';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';

/**
 * Built-in translation-aware text field for the collection editor. Wraps {@link LocalizedField}
 * (locale switcher) around an {@link Input} (or {@link TextArea} when `multiline`), storing a
 * per-locale value object. Wired in field-renderer for `admin.component:'LocalizedText'` /
 * `'LocalizedTextarea'`. Legacy plain-string values are shown as a fallback until edited.
 */
export class LocalizedTextField extends PureReactor {
  /** Per-locale value object `{ en: '…', bg: '…' }`, or a legacy plain string. */
  @prop declare value: any;
  @prop declare onChange: (value: Record<string, string>) => void;
  @prop declare disabled?: boolean;
  @prop declare multiline?: boolean;
  @prop declare field?: { label?: string; name?: string };

  private getMap(): Record<string, string> {
    const { value } = this;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>;
    return {};
  }

  render(): ReactNode {
    const { onChange, field, multiline, disabled, value } = this;
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
