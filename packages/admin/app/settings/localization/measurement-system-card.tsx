import React from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from './setting-row';
import type { MeasurementSystemCardProps } from './measurement-system-card.interfaces';

/**
 * Platform-wide measurement system (metric / imperial). A regional format like locale — domain plugins
 * (e.g. ecommerce package dimensions & weight) read it; couriers still always receive kilograms.
 */
export class MeasurementSystemCard extends React.Component<MeasurementSystemCardProps> {
  render(): React.ReactNode {
    const { theme, measurementSystem, setMeasurementSystem } = this.props;
    return (
      <Card title="Region & Units">
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Measurement System"
          description="Units used across the platform for physical dimensions and weight (e.g. product packages). Metric = cm/kg, Imperial = in/lb."
        >
          <Select
            value={measurementSystem}
            onChange={(value) => setMeasurementSystem((value as 'metric' | 'imperial') || 'metric')}
            options={[
              { value: 'metric', label: 'Metric (cm / kg)' },
              { value: 'imperial', label: 'Imperial (in / lb)' }
            ]}
            placeholder="Select measurement system"
            searchable={false}
            theme={theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}
