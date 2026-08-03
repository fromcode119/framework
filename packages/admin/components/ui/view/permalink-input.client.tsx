import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { prop, state, bound, watch } from '@fromcode119/reactor';
import type { ICollection } from '@fromcode119/core/client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { UiFieldUtils } from '@/lib/ui';
import { PermalinkInputUtils } from '@/components/ui/permalink-input-utils';
import type { IPermalinkComputed } from '@/components/ui/interfaces/permalink-computed.interface';

export class PermalinkInput extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<PermalinkInput, 'value' | 'onChange' | 'placeholder' | 'disabled' | 'id' | 'slug' | 'collection' | 'pluginSettings'>;

  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare placeholder?: string;
  @prop declare disabled?: boolean;
  @prop declare id?: string;
  @prop declare slug?: string;
  @prop declare collection?: ICollection;
  @prop declare pluginSettings?: Record<string, any>;

  @state private isEditing = false;
  @state private useAbsolutePath = String(this.props.value || '').startsWith('/');

  private compute(): IPermalinkComputed {
    return PermalinkInputUtils.compute(this.props, this.runtime?.globalSettings ?? null);
  }

  componentDidMount(): void {
    this.syncAbsoluteFromValue();
  }

  // `@state` mutates `this.state` in place, so React's `prevState` is unreliable for detecting an
  // edge — use `@watch` (which snapshots previous values) to re-sync when the value or edit mode changes.
  @watch('value', 'isEditing')
  private syncAbsoluteFromValue(): void {
    if (this.isEditing) return;
    const isAbsoluteOverride = String(this.value || '').startsWith('/');
    if (this.useAbsolutePath !== isAbsoluteOverride) {
      this.useAbsolutePath = isAbsoluteOverride;
    }
  }

  @bound
  private handleValueChange(nextValue: string): void {
    const normalizedNext = String(nextValue || '').replace(/^\/+/, '');
    this.onChange(this.useAbsolutePath ? `/${normalizedNext}` : normalizedNext);
  }

  render(): ReactNode {
    const { onChange, disabled } = this;
    const { isEditing, useAbsolutePath } = this;
    const { baseUrl, finalPrefix, fullDisplayPrefix, displayValue, suffix, isCustomMode, isAbsoluteOverride } = this.compute();

    if (!isEditing) {
      return (
        <div
          onClick={() => !disabled && (this.isEditing = true)}
          title={`${fullDisplayPrefix}${displayValue}${suffix}`}
          className={`group relative min-h-[56px] px-3.5 py-2 rounded-lg border transition-all overflow-hidden ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3 w-full">
             <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10px] leading-tight text-slate-400 font-medium break-all opacity-70">{fullDisplayPrefix}</span>
                <span className={`text-[13px] leading-tight font-semibold break-all ${isCustomMode ? 'text-indigo-600' : 'text-slate-900 dark:text-white'}`}>
                  {displayValue}{suffix}
                </span>
             </div>
             <div className="flex items-start gap-2 shrink-0 pt-0.5">
                {isCustomMode && (
                   <div className="h-5 px-1.5 flex items-center bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-500/20">
                      {isAbsoluteOverride ? 'Absolute Path' : 'Custom Path'}
                   </div>
                )}
                <div className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                   <FrameworkIcons.Edit size={12} />
                </div>
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-end px-1">
          <label className={UiFieldUtils.TEXT.LABEL}>Edit Path Override</label>
          {isCustomMode && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); this.isEditing = false; }}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
            >
              <FrameworkIcons.Refresh size={8} />
              Revert
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const nextAbsolute = !useAbsolutePath;
            this.useAbsolutePath = nextAbsolute;
            const normalizedCurrent = String(displayValue || '').replace(/^\/+/, '');
            onChange(nextAbsolute ? `/${normalizedCurrent}` : normalizedCurrent);
          }}
          className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
            useAbsolutePath
              ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          {useAbsolutePath
            ? 'Absolute path override enabled: this record bypasses the global prefix.'
            : 'Relative path mode: this record inherits the global collection prefix.'}
        </button>

        <div className="flex flex-col gap-2">
          <div className={`${UiFieldUtils.getFieldClasses(FieldSize.MD, 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl bg-white dark:bg-slate-950 px-3.5 py-0 flex flex-col justify-center', false)}`}>
             <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 opacity-60 leading-none mb-1">
                <FrameworkIcons.Layout size={10} />
                <span className="truncate">{baseUrl}{useAbsolutePath ? '/' : finalPrefix}</span>
             </div>
             <input
                autoFocus
                value={displayValue ?? ''}
                onChange={(e) => this.handleValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') this.isEditing = false;
                  if (e.key === 'Escape') this.isEditing = false;
                }}
                className="w-full bg-transparent text-[13px] font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 leading-none"
                placeholder="my-secret-path"
             />
          </div>

          <div className="flex gap-2">
             <Button
                className="flex-1 font-bold text-[11px]"
                onClick={() => this.isEditing = false}
             >
                Save Override
             </Button>
             <Button
                variant={ButtonVariant.GHOST}
                className="px-4 text-[11px] font-bold"
                onClick={() => this.isEditing = false}
             >
                Cancel
             </Button>
          </div>
        </div>
        <p className={UiFieldUtils.TEXT.SUBTEXT}>
          Relative overrides inherit the collection prefix. Enable absolute mode to bypass prefixes like `/shop`.
        </p>
      </div>
    );
  }
}
