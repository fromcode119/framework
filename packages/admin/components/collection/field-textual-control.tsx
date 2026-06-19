import React from 'react';
import { TextArea } from '@/components/ui/text-area';
import { Input } from '@/components/ui/input';
import type { FieldTextualControlProps } from './field-renderer.interfaces';

export class FieldTextualControl extends React.Component<FieldTextualControlProps> {
  render(): React.ReactNode {
    const {
      kind, currentValue, resolvedCurrentText, updateValue, isFieldReadOnly, errors,
      label, isLocalizedField, shouldInlineLocaleSwitcher, localeSwitcher, wrapWithReadOnlyOverride
    } = this.props;
    const switcher = isLocalizedField && shouldInlineLocaleSwitcher;

    if (kind === 'textarea') {
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

    if (kind === 'json') {
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
