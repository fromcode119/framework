"use client";

import React from 'react';
import { ContextBridge } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { ThemeLayoutFieldProps } from './theme-layout-field.interfaces';
import type { ThemeLayoutFieldState, ThemeLayoutOption } from './theme-layout-field.types';

function humanizeLayoutName(name: string): string {
  return String(name || '').replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Framework-owned, no-magic layout picker. Lists ONLY the layouts the active theme actually declares
 * (read from theme metadata), with an explicit "Auto = theme default" option. A stored value that
 * isn't a real theme layout is surfaced as a flagged option AND a warning with a one-click reset, and
 * the box always states the layout the frontend will truly render. Any plugin uses it via
 * `admin.component: 'ThemeLayoutField'`; registered into the field-component registry at admin bootstrap.
 */
export class ThemeLayoutField extends React.Component<ThemeLayoutFieldProps, ThemeLayoutFieldState> {
  state: ThemeLayoutFieldState = { options: [], layoutInfoByValue: {}, runtimeDefaultLayout: 'DefaultLayout', loading: true };
  private active = true;

  componentDidMount(): void {
    void this.fetchLayouts();
  }

  componentWillUnmount(): void {
    this.active = false;
  }

  private async fetchLayouts(): Promise<void> {
    try {
      const metadata = await ContextBridge.getFrontendMetadata();
      const rawLayouts = metadata?.activeTheme?.layouts;
      const inferredDefault = String(metadata?.activeTheme?.defaultLayout || '').trim() || 'DefaultLayout';
      if (!this.active) return;

      const layouts: ThemeLayoutOption[] = Array.isArray(rawLayouts)
        ? rawLayouts
            .map((layout: any) => {
              const name = typeof layout?.name === 'string' ? layout.name : '';
              if (!name) return null;
              return { label: layout?.label || humanizeLayoutName(name), value: name, description: typeof layout?.description === 'string' ? layout.description : '' };
            })
            .filter(Boolean) as ThemeLayoutOption[]
        : rawLayouts && typeof rawLayouts === 'object'
          ? Object.keys(rawLayouts).map((key) => ({ label: humanizeLayoutName(key), value: key }))
          : [];

      const infoMap: Record<string, ThemeLayoutOption> = {};
      layouts.forEach((item) => { infoMap[item.value] = item; });
      const autoLabel = infoMap[inferredDefault]?.label || humanizeLayoutName(inferredDefault);

      this.setState({
        runtimeDefaultLayout: inferredDefault,
        layoutInfoByValue: infoMap,
        options: [{ label: `Auto (${autoLabel})`, value: '' }, ...layouts.map(({ label, value }) => ({ label, value }))],
      });
    } catch (err) {
      console.error('[ThemeLayoutField] Failed to fetch theme layouts:', err);
    } finally {
      if (this.active) this.setState({ loading: false });
    }
  }

  render(): React.ReactNode {
    const { value, onChange, theme = 'light', disabled, field } = this.props;
    const { options, layoutInfoByValue, runtimeDefaultLayout, loading } = this.state;
    const isDark = theme === 'dark';
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;

    const explicitValue = String(value || '').trim();
    const isAutoMode = !explicitValue;
    const selectedLayoutMissing = !isAutoMode && !layoutInfoByValue[explicitValue];

    const effectiveValue = isAutoMode || selectedLayoutMissing ? runtimeDefaultLayout : explicitValue;
    const effectiveLabel = layoutInfoByValue[effectiveValue]?.label || humanizeLayoutName(effectiveValue) || 'Default';
    const effectiveDescription = layoutInfoByValue[effectiveValue]?.description || '';

    const selectOptions = selectedLayoutMissing
      ? [...options, { label: `⚠ ${explicitValue} (not in active theme)`, value: explicitValue }]
      : options;

    return (
      <div className="space-y-2">
        <Select
          value={value || ''}
          onChange={(v: any) => onChange?.(typeof v === 'string' ? v : v?.target?.value)}
          options={selectOptions}
          disabled={readOnly || loading}
          theme={theme}
          placeholder="Auto (theme default)"
        />
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Pick a layout your active theme provides, or leave on Auto to use the theme default.
        </p>

        {selectedLayoutMissing ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Layout not found in theme</p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
              The active theme has no layout named <b>{explicitValue}</b>, so the frontend renders <b>{effectiveLabel}</b> ({effectiveValue}) instead. Choose a layout the theme provides, or reset to Auto.
            </p>
            <div className="mt-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => onChange?.('')}>Reset to Auto (theme default)</Button>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Frontend renders</p>
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{effectiveLabel} ({effectiveValue})</p>
            <p className={`mt-1 text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isAutoMode ? 'Auto — this follows the active theme’s default layout.' : 'Explicitly uses this layout from the active theme.'}
            </p>
            {effectiveDescription ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{effectiveDescription}</p> : null}
          </div>
        )}
      </div>
    );
  }
}
