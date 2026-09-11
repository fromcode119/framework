import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { TimezoneUtils } from '@/lib/timezone';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * Step three: what this installation calls itself, and the zone its dates are shown in.
 *
 * Both are optional. An empty name writes nothing — the console keeps its own — rather than storing
 * a name nobody typed, and the same is true of a timezone left as the browser's.
 */
export class SetupPlatformStep extends PureReactor {
  @prop declare locale: string;
  @prop declare platformName: string;
  @prop declare timezone: string;
  @prop declare onPlatformNameChange: (value: string) => void;
  @prop declare onTimezoneChange: (value: string) => void;

  @bound
  private handleName(event: ChangeEvent<HTMLInputElement>): void {
    this.onPlatformNameChange(event.target.value);
  }

  private get timezoneOptions() {
    return TimezoneUtils.getTimezoneOptions(this.timezone);
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  render(): ReactNode {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Input
            label={this.text('setup.platform.name')}
            value={this.platformName}
            onChange={this.handleName}
            className="py-3 text-sm"
          />
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {this.text('setup.platform.nameHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Select
            label={this.text('setup.platform.timezone')}
            value={this.timezone}
            onChange={this.onTimezoneChange}
            options={this.timezoneOptions}
            searchable
          />
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {this.text('setup.platform.timezoneHelp')}
          </p>
        </div>
      </div>
    );
  }
}
