import React from 'react';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import type { FieldSelectControlProps } from './field-renderer.interfaces';

export class FieldSelectControl extends React.Component<FieldSelectControlProps> {
  render(): React.ReactNode {
    const { field, currentValue, updateValue, theme, isFieldReadOnly, wrapWithReadOnlyOverride } = this.props;
    const options = (field.options || []).map((option: any) => ({
      label: String(option?.label ?? option?.value ?? ''),
      value: option?.value
    }));
    const isMultiSelect = Boolean(field.admin?.multiple || (field as any).multiple);
    const resolvedSelectValue = currentValue === undefined || currentValue === null
      ? (field.defaultValue ?? '')
      : currentValue;

    if (!isMultiSelect) {
      return wrapWithReadOnlyOverride(
        <Select
          value={resolvedSelectValue}
          options={options}
          onChange={updateValue}
          disabled={isFieldReadOnly}
          theme={theme}
          clearable={Boolean(field.admin?.clearable)}
        />
      );
    }

    const selectedValues = Array.isArray(currentValue)
      ? currentValue.map((item: any) => String(item)).filter(Boolean)
      : (typeof currentValue === 'string'
        ? currentValue.split(',').map((item) => item.trim()).filter(Boolean)
        : []);
    const selectedSet = new Set(selectedValues);
    const optionValueToRaw = new Map(options.map((option) => [String(option.value), option.value]));
    const optionValueToLabel = new Map(options.map((option) => [String(option.value), option.label]));
    const availableOptions = options.filter((option) => !selectedSet.has(String(option.value)));

    const persistSelected = (values: string[]) => {
      const rawValues = values.map((item) => optionValueToRaw.get(item) ?? item);
      updateValue(rawValues);
    };

    return wrapWithReadOnlyOverride(
      <div className="space-y-2">
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((selected) => (
              <span
                key={selected}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span>{optionValueToLabel.get(selected) || selected}</span>
                {!isFieldReadOnly && (
                  <button
                    type="button"
                    onClick={() => persistSelected(selectedValues.filter((item) => item !== selected))}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <FrameworkIcons.Close size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <Select
          value=""
          options={availableOptions}
          onChange={(value) => {
            const selected = String(value || '').trim();
            if (!selected || selectedSet.has(selected)) return;
            persistSelected([...selectedValues, selected]);
          }}
          disabled={isFieldReadOnly || availableOptions.length === 0}
          placeholder={availableOptions.length ? 'Select an option...' : 'All options selected'}
          theme={theme}
        />
      </div>
    );
  }
}
