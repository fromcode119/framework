import React from 'react';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/ui/number-stepper';
import { FrameworkIcons } from '@fromcode119/react';
import type { FieldTextInputProps } from './field-renderer.interfaces';

export class FieldTextInput extends React.Component<FieldTextInputProps> {
  render(): React.ReactNode {
    const {
      field, currentValue, resolvedCurrentText, updateValue, isFieldReadOnly, isNew, errors,
      label, slugWarning, slugManuallyEdited, isLocalizedField, shouldInlineLocaleSwitcher,
      localeSwitcher, wrapWithReadOnlyOverride
    } = this.props;
    // Number fields use the platform stepper (input + explicit +/- controls), not the bare browser input.
    if (field.type === 'number') {
      const admin = (field.admin || {}) as Record<string, any>;
      return wrapWithReadOnlyOverride(
        <NumberStepper
          value={typeof currentValue === 'number' || typeof currentValue === 'string' ? currentValue : ''}
          onChange={updateValue}
          disabled={isFieldReadOnly}
          error={errors?.[0]}
          placeholder={`Enter ${label}...`}
          step={admin.step ?? (field as any).step}
          min={admin.min ?? (field as any).min}
          max={admin.max ?? (field as any).max}
        />
      );
    }
    return wrapWithReadOnlyOverride(
      <div className="relative">
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          value={field.type === 'number' ? (typeof currentValue === 'number' || typeof currentValue === 'string' ? currentValue : '') : (typeof currentValue === 'string' ? currentValue : resolvedCurrentText)}
          onChange={(e) => {
            if (field.type === 'number') {
              const raw = e.target.value;
              if (raw === '') {
                updateValue('');
                return;
              }
              const parsed = Number(raw);
              updateValue(Number.isFinite(parsed) ? parsed : raw);
              return;
            }
            updateValue(e.target.value);
          }}
          placeholder={`Enter ${label}...`}
          disabled={isFieldReadOnly}
          error={errors?.[0]}
          inputClassName={`${field.name === 'slug' && slugWarning ? 'border-amber-400 focus:ring-amber-400/20 ' : ''}${isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}`}
        />
        {isLocalizedField && shouldInlineLocaleSwitcher && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">{localeSwitcher(true)}</div>
        )}
        {field.name === 'slug' && slugWarning && (
          <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-xs font-medium text-amber-500 animate-in fade-in slide-in-from-top-1 px-1">
            <FrameworkIcons.Alert size={12} />
            <span>{slugWarning}</span>
          </div>
        )}
        {field.name === 'slug' && !slugManuallyEdited && isNew && currentValue && (
          <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-[10px] font-semibold tracking-wide animate-pulse border border-indigo-500/20 pointer-events-none">
            <FrameworkIcons.Refresh size={8} />
            Auto
          </div>
        )}
      </div>
    );
  }
}
