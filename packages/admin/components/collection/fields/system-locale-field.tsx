"use client";

import React from 'react';
import { Select } from '@/components/ui/select';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { SystemLocaleOptionsService } from './system-locale-options-service';
import type { SystemLocaleFieldProps } from './system-locale-field.interfaces';
import type { SystemLocaleFieldState } from './system-locale-field.types';

/**
 * Built-in, framework-owned locale picker. Renders a dropdown of the platform's configured
 * locales (read live from the localization system settings — the same source the Localization
 * settings page writes), so any plugin field that means "pick a system locale" sets
 * `admin.component: 'SystemLocaleField'` instead of a free-text input. Registered into the
 * shared field-component registry at admin bootstrap, so it also works inside array sub-fields.
 */
export class SystemLocaleField extends React.Component<SystemLocaleFieldProps, SystemLocaleFieldState> {
  state: SystemLocaleFieldState = { options: [], loaded: false };

  componentDidMount(): void {
    AdminSystemSettingsClient.getAll()
      .then((settings) => {
        const options = SystemLocaleOptionsService.fromSettings(settings);
        this.setState({ options });
        if (!this.props.value && options[0]?.value && this.props.onChange) {
          this.props.onChange(options[0].value);
        }
      })
      .catch(() => this.setState({ options: SystemLocaleOptionsService.fallback() }))
      .finally(() => this.setState({ loaded: true }));
  }

  render(): React.ReactNode {
    const { value, onChange, theme, disabled, field } = this.props;
    const { options, loaded } = this.state;
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;

    if (!loaded) {
      return (
        <Select
          value=""
          onChange={() => undefined}
          options={[{ label: 'Loading locales…', value: '' }]}
          disabled
          theme={theme}
        />
      );
    }

    return (
      <Select
        value={value || options[0]?.value || ''}
        onChange={(next: string) => onChange?.(next)}
        options={options}
        placeholder="Select locale…"
        disabled={readOnly}
        theme={theme}
      />
    );
  }
}
