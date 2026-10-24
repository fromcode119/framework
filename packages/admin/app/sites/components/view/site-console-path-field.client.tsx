import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The path on a site's own hosts its console is served at (`/backend`), with the address it makes.
 *
 * The second place a site's console can live, beside a host whose role is Console. A workspace IS a
 * console on its hosts, so the form renders this for sites only.
 */
export class SiteConsolePathField extends PureReactor {
  @prop declare values: SiteFormValues;
  @prop declare onChange: (patch: Partial<SiteFormValues>) => void;

  @bound private onConsolePath(e: ChangeEvent<HTMLInputElement>): void {
    this.onChange({ consolePath: e.target.value });
  }

  /** The address the hint shows: the path as typed on this site's primary host. */
  private get example(): string {
    const host = this.values.primaryHost.trim() || AdminI18n.t('sites.slugExample');
    const raw = this.values.consolePath.trim() || AdminI18n.t('sites.consolePathPlaceholder');
    return `${host}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  render(): ReactNode {
    return (
      <div className="fc-site-form__block">
        <Input
          label={AdminI18n.t('sites.consolePath')}
          value={this.values.consolePath}
          onChange={this.onConsolePath}
          placeholder={AdminI18n.t('sites.consolePathPlaceholder')}
          spellCheck={false}
          autoCapitalize="off"
        />
        <p className="fc-site-form__hint">{AdminI18n.t('sites.consolePathHint', { example: this.example })}</p>
      </div>
    );
  }
}
