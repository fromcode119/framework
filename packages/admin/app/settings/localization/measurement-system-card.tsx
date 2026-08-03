import { MeasurementSystem } from '@fromcode119/core/client';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/localization/setting-row';

/**
 * Platform-wide measurement system (metric / imperial). A regional format like locale — domain plugins
 * (e.g. ecommerce package dimensions & weight) read it; couriers still always receive kilograms.
 */
export class MeasurementSystemCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare measurementSystem: MeasurementSystem;
  @prop declare setMeasurementSystem: (value: MeasurementSystem) => void;

  @bound
  protected onMeasurementSystemChange(value: string): void {
    this.setMeasurementSystem(MeasurementSystem.resolve(value));
  }

  render(): ReactNode {
    return (
      <Card title="Region & Units">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title="Measurement System"
          description="Units used across the platform for physical dimensions and weight (e.g. product packages). Metric = cm/kg, Imperial = in/lb."
        >
          <Select
            value={this.measurementSystem.value}
            onChange={this.onMeasurementSystemChange}
            options={[
              { value: 'metric', label: 'Metric (cm / kg)' },
              { value: 'imperial', label: 'Imperial (in / lb)' }
            ]}
            placeholder="Select measurement system"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}
