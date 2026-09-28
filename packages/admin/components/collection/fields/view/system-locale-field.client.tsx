import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { SystemLocaleOptionsService } from '@/components/collection/fields/system-locale-options-service';
import { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Built-in, framework-owned locale picker. Renders a dropdown of the platform's configured
 * locales (read live from the localization system settings — the same source the Localization
 * settings page writes), so any plugin field that means "pick a system locale" sets
 * `admin.component: 'SystemLocaleField'` instead of a free-text input. Registered into the
 * shared field-component registry at admin bootstrap, so it also works inside array sub-fields.
 */
export class SystemLocaleField extends Reactor {
  @prop declare value?: string;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  @state options: ISystemLocaleOption[] = [];
  @state loaded = false;

  componentDidMount(): void {
    AdminSystemSettingsClient.getAll()
      .then((settings) => {
        const options = SystemLocaleOptionsService.fromSettings(settings);
        this.options = options;
        if (!this.value && options[0]?.value && this.onChange) {
          this.onChange(options[0].value);
        }
      })
      .catch(() => { this.options = SystemLocaleOptionsService.fallback(); })
      .finally(() => { this.loaded = true; });
  }

  render(): ReactNode {
    const { value, onChange, theme, disabled, field, options, loaded } = this;
    const readOnly = Boolean(field?.admin?.readOnly) || disabled;

    if (!loaded) {
      return (
        <Select
          value=""
          onChange={() => undefined}
          options={[{ label: AdminI18n.t('ui.locales.loading'), value: '' }]}
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
        placeholder={AdminI18n.t('ui.locales.select')}
        disabled={readOnly}
        theme={theme}
      />
    );
  }
}
