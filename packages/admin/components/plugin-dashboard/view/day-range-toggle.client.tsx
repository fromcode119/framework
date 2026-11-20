import { Tabs } from '@/components/ui/view/tabs.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The single canonical date-range selector for every admin dashboard.
 * A clean segmented control — presets only. Keep the API stable (value/onChange/options)
 * so all consumers (plugin overviews + framework dashboards) stay visually consistent.
 */
export class DayRangeToggle extends PureReactor {
  @prop declare value: number;
  @prop declare onChange: (days: number) => void;
  @prop declare options?: number[];
  @prop declare label?: string;

  render(): ReactNode {
    const options = this.options ?? [7, 14, 30];
    const label = this.label ?? AdminI18n.t('ui.range');
    // The days name themselves; a visible "Range" beside them read as a fourth choice. It names the
    // group for a screen reader instead, and the choices share one track so they read as one control.
    return (
      <Tabs className="fc-tabs--segmented" label={label} value={String(this.value)} onChange={(key: string) => this.onChange(Number(key))}
        tabs={options.map((days) => ({ id: String(days), label: AdminI18n.t('ui.rangeDays', { days }) }))} />
    );
  }
}
