import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export class FieldRendererHeader extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare label: string;
  @prop declare theme: ThemeMode;
  @prop declare isFieldReadOnly: boolean;
  @prop declare supportsReadOnlyOverride: boolean;
  @prop declare readOnlyOverrideGranted: boolean;
  @prop declare canRequestReadOnlyOverride: boolean;
  @prop declare isLocalizedField: boolean;
  @prop declare componentHandlesLocalization: boolean;
  @prop declare shouldInlineLocaleSwitcher: boolean;
  @prop declare onRequestReadOnlyOverride: () => void;
  @prop declare localeSwitcher: (compact?: boolean) => ReactNode;

  render(): ReactNode {
    const {
      field, label, theme, isFieldReadOnly, supportsReadOnlyOverride, readOnlyOverrideGranted,
      canRequestReadOnlyOverride, isLocalizedField, componentHandlesLocalization,
      shouldInlineLocaleSwitcher, onRequestReadOnlyOverride, localeSwitcher
    } = this;
    return (
      <div className="flex items-center justify-between gap-3 mb-1 min-h-[22px]">
        {!field.admin?.hideLabel && (
        <label className={UiFieldUtils.TEXT.LABEL}>
          {label}
          {field.required && <span className="text-rose-500 ml-1 font-semibold font-sans">*</span>}
        </label>
        )}

        <div className="flex items-center gap-2">
          {!isFieldReadOnly && supportsReadOnlyOverride && readOnlyOverrideGranted && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-semibold tracking-wide border ${
                theme === ThemeMode.DARK
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <FrameworkIcons.Check size={10} />
              Override unlocked
            </span>
          )}
          {isFieldReadOnly && (canRequestReadOnlyOverride ? (
            <button
              type="button"
              onClick={onRequestReadOnlyOverride}
              title={`Unlock "${label}" to edit`}
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-semibold tracking-wide border transition-colors ${
                theme === ThemeMode.DARK
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/15'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <FrameworkIcons.Lock size={10} />
              Unlock edit
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-semibold tracking-wide border ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <FrameworkIcons.Lock size={10} />
              Read only
            </span>
          ))}
          {isLocalizedField && !componentHandlesLocalization && !shouldInlineLocaleSwitcher && localeSwitcher(false)}
        </div>
      </div>
    );
  }
}
