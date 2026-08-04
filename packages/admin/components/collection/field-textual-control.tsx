import { TextualFieldKind } from '@/components/collection/enums/textual-field-kind.enum';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Input } from '@/components/ui/view/input.client';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export class FieldTextualControl extends PureReactor {
  /**
   * MUST be a `TextualFieldKind` MEMBER, never the raw string.
   * Callers previously passed JSX string literals (`kind="textarea"`), so every
   * `kind === TextualFieldKind.TEXTAREA` comparison was string-vs-Enum-instance — always false —
   * and EVERY textarea/json field fell through to the password fallback below (rendering
   * `type="password"` with a `••••••••` placeholder). `next build` sets `ignoreBuildErrors`, so
   * the type mismatch never surfaced.
   */
  @prop declare kind: TextualFieldKind;
  @prop declare field: ICollectionField;
  @prop declare currentValue: any;
  @prop declare resolvedCurrentText: string;
  @prop declare updateValue: (value: any) => void;
  @prop declare isFieldReadOnly: boolean;
  @prop declare errors?: string[];
  @prop declare label: string;
  @prop declare isLocalizedField: boolean;
  @prop declare shouldInlineLocaleSwitcher: boolean;
  @prop declare localeSwitcher: (compact?: boolean) => React.ReactNode;
  @prop declare wrapWithReadOnlyOverride: (node: React.ReactNode, roundedClass?: string) => React.ReactNode;

  render(): React.ReactNode {
    const {
      kind, currentValue, resolvedCurrentText, updateValue, isFieldReadOnly, errors,
      label, isLocalizedField, shouldInlineLocaleSwitcher, localeSwitcher, wrapWithReadOnlyOverride
    } = this;
    const switcher = isLocalizedField && shouldInlineLocaleSwitcher;

    if (kind === TextualFieldKind.TEXTAREA) {
      return wrapWithReadOnlyOverride(
        <div className="relative">
          <TextArea
            value={typeof currentValue === 'string' ? currentValue : resolvedCurrentText}
            onChange={(e) => updateValue(e.target.value)}
            disabled={isFieldReadOnly}
            placeholder={`Enter ${label}...`}
            error={errors?.[0]}
            inputClassName={switcher ? 'pr-16' : ''}
          />
          {switcher && (
            <div className="absolute right-2 top-2 z-20">{localeSwitcher(true)}</div>
          )}
        </div>
      );
    }

    if (kind === TextualFieldKind.JSON) {
      return wrapWithReadOnlyOverride(
        <div className="relative">
          <TextArea
            value={typeof currentValue === 'object' ? JSON.stringify(currentValue, null, 2) : currentValue || ''}
            onChange={(e) => {
              try {
                const val = JSON.parse(e.target.value);
                updateValue(val);
              } catch (err) {
                updateValue(e.target.value);
              }
            }}
            disabled={isFieldReadOnly}
            inputClassName={`font-mono text-[12px] ${switcher ? 'pr-16' : ''}`}
          />
          {switcher && (
            <div className="absolute right-2 top-2 z-20">{localeSwitcher(true)}</div>
          )}
        </div>
      );
    }

    return wrapWithReadOnlyOverride(
      <div className="relative">
        <Input
          type="password"
          value={typeof currentValue === 'string' ? currentValue : resolvedCurrentText}
          onChange={(e) => updateValue(e.target.value)}
          placeholder="••••••••"
          disabled={isFieldReadOnly}
          error={errors?.[0]}
          inputClassName={switcher ? 'pr-16' : ''}
        />
        {switcher && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">{localeSwitcher(true)}</div>
        )}
      </div>
    );
  }
}
