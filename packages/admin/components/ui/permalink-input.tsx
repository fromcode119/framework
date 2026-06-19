"use client";

import React from 'react';
import { Button } from './button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/admin-component';
import { UiFieldUtils } from '@/lib/ui';
import { PermalinkInputUtils } from './permalink-input-utils';
import type { PermalinkInputProps, PermalinkInputState, PermalinkComputed } from './permalink-input.interfaces';

export class PermalinkInput extends AdminComponent<PermalinkInputProps, PermalinkInputState> {
  state: PermalinkInputState = {
    isEditing: false,
    useAbsolutePath: String(this.props.value || '').startsWith('/'),
  };

  private compute(): PermalinkComputed {
    return PermalinkInputUtils.compute(this.props, this.runtime?.globalSettings ?? null);
  }

  private syncAbsoluteFromValue(): void {
    if (this.state.isEditing) return;
    const isAbsoluteOverride = String(this.props.value || '').startsWith('/');
    if (this.state.useAbsolutePath !== isAbsoluteOverride) {
      this.setState({ useAbsolutePath: isAbsoluteOverride });
    }
  }

  componentDidMount(): void {
    this.syncAbsoluteFromValue();
  }

  componentDidUpdate(prevProps: PermalinkInputProps, prevState: PermalinkInputState): void {
    if (prevProps.value !== this.props.value || prevState.isEditing !== this.state.isEditing) {
      this.syncAbsoluteFromValue();
    }
  }

  private handleValueChange = (nextValue: string): void => {
    const normalizedNext = String(nextValue || '').replace(/^\/+/, '');
    this.props.onChange(this.state.useAbsolutePath ? `/${normalizedNext}` : normalizedNext);
  };

  render(): React.ReactNode {
    const { onChange, disabled } = this.props;
    const { isEditing, useAbsolutePath } = this.state;
    const { baseUrl, finalPrefix, fullDisplayPrefix, displayValue, suffix, isCustomMode, isAbsoluteOverride } = this.compute();

    if (!isEditing) {
      return (
        <div
          onClick={() => !disabled && this.setState({ isEditing: true })}
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
                   <div className="h-5 px-1.5 flex items-center bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-md border border-indigo-500/20">
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
              onClick={(e) => { e.stopPropagation(); onChange(''); this.setState({ isEditing: false }); }}
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
            this.setState({ useAbsolutePath: nextAbsolute });
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
          <div className={`${UiFieldUtils.getFieldClasses('md', 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl bg-white dark:bg-slate-950 px-3.5 py-0 flex flex-col justify-center', false)}`}>
             <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 opacity-60 leading-none mb-1">
                <FrameworkIcons.Layout size={10} />
                <span className="truncate">{baseUrl}{useAbsolutePath ? '/' : finalPrefix}</span>
             </div>
             <input
                autoFocus
                value={displayValue ?? ''}
                onChange={(e) => this.handleValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') this.setState({ isEditing: false });
                  if (e.key === 'Escape') this.setState({ isEditing: false });
                }}
                className="w-full bg-transparent text-[13px] font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 leading-none"
                placeholder="my-secret-path"
             />
          </div>

          <div className="flex gap-2">
             <Button
                className="flex-1 font-bold text-[11px]"
                onClick={() => this.setState({ isEditing: false })}
             >
                Save Override
             </Button>
             <Button
                variant="ghost"
                className="px-4 text-[11px] font-bold"
                onClick={() => this.setState({ isEditing: false })}
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
