import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { ContextBridge } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { IThemeLayoutOption } from '@/components/collection/fields/interfaces/theme-layout-option.interface';

/**
 * Framework-owned, no-magic layout picker. Lists ONLY the layouts the active theme actually declares
 * (read from theme metadata), with an explicit "Auto = theme default" option. A stored value that
 * isn't a real theme layout is surfaced as a flagged option AND a warning with a one-click reset, and
 * the box always states the layout the frontend will truly render. Any plugin uses it via
 * `admin.component: 'ThemeLayoutField'`; registered into the field-component registry at admin bootstrap.
 */
export class ThemeLayoutField extends Reactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  @state options: IThemeLayoutOption[] = [];
  @state layoutInfoByValue: Record<string, IThemeLayoutOption> = {};
  /** Empty until the active theme declares one — the framework never invents a layout name. */
  @state runtimeDefaultLayout = '';
  @state loading = true;

  private active = true;

  private humanizeLayoutName(name: string): string {
    return String(name || '').replace(/([A-Z])/g, ' $1').trim();
  }

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
      const inferredDefault = String(metadata?.activeTheme?.defaultLayout || '').trim();
      if (!this.active) return;

      const layouts: IThemeLayoutOption[] = Array.isArray(rawLayouts)
        ? rawLayouts
            .map((layout: any) => {
              const name = typeof layout?.name === 'string' ? layout.name : '';
              if (!name) return null;
              return { label: layout?.label || this.humanizeLayoutName(name), value: name, description: typeof layout?.description === 'string' ? layout.description : '' };
            })
            .filter(Boolean) as IThemeLayoutOption[]
        : rawLayouts && typeof rawLayouts === 'object'
          ? Object.keys(rawLayouts).map((key) => ({ label: this.humanizeLayoutName(key), value: key }))
          : [];

      const infoMap: Record<string, IThemeLayoutOption> = {};
      layouts.forEach((item) => { infoMap[item.value] = item; });
      const autoLabel = infoMap[inferredDefault]?.label || this.humanizeLayoutName(inferredDefault);

      this.runtimeDefaultLayout = inferredDefault;
      this.layoutInfoByValue = infoMap;
      this.options = [{ label: `Auto (${autoLabel})`, value: '' }, ...layouts.map(({ label, value }) => ({ label, value }))];
    } catch (err) {
      console.error('[ThemeLayoutField] Failed to fetch theme layouts:', err);
    } finally {
      if (this.active) this.loading = false;
    }
  }

  @bound
  private handleSelectChange(v: any): void {
    this.onChange?.(typeof v === 'string' ? v : v?.target?.value);
  }

  @bound
  private resetToAuto(): void {
    this.onChange?.('');
  }

  render(): ReactNode {
    const value = this.value;
    const theme = this.theme ?? ThemeMode.LIGHT;
    const field = this.field;
    const { options, layoutInfoByValue, runtimeDefaultLayout, loading } = this;
    const isDark = theme === ThemeMode.DARK;
    const readOnly = Boolean(field?.admin?.readOnly) || this.disabled;

    const explicitValue = String(value || '').trim();
    const isAutoMode = !explicitValue;
    const selectedLayoutMissing = !isAutoMode && !layoutInfoByValue[explicitValue];

    const effectiveValue = isAutoMode || selectedLayoutMissing ? runtimeDefaultLayout : explicitValue;
    const effectiveLabel = layoutInfoByValue[effectiveValue]?.label || this.humanizeLayoutName(effectiveValue) || 'Default';
    const effectiveDescription = layoutInfoByValue[effectiveValue]?.description || '';

    const selectOptions = selectedLayoutMissing
      ? [...options, { label: `⚠ ${explicitValue} (not in active theme)`, value: explicitValue }]
      : options;

    return (
      <div className="space-y-2">
        <Select
          value={value || ''}
          onChange={this.handleSelectChange}
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
              <Button type="button" size={FieldSize.SM} variant={ButtonVariant.SECONDARY} onClick={this.resetToAuto}>Reset to Auto (theme default)</Button>
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
