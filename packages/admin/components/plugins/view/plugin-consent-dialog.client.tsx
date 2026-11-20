import type { ReactNode } from 'react';
import { prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Switch } from '@/components/ui/view/switch.client';
import { PluginConsentEntries } from '@/components/plugins/view/plugin-consent-entries.client';
import { PluginConsentFacts } from '@/components/plugins/view/plugin-consent-facts.client';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { PluginConsentRequest } from '@/components/plugins/plugin-consent-request';
import { PluginConsentScope } from '@/components/plugins/enums/plugin-consent-scope.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Asks an operator to approve exactly what a plugin will be able to do before any of it runs.
 *
 * Approve stays disabled until the operator confirms they read it. The list sent back is the one on
 * screen; if the plugin changed in the meantime the server refuses it, and the dialog shows the new
 * request instead of approving something nobody saw.
 */
export class PluginConsentDialog extends AdminComponent {
  @prop declare summary: IPluginConsentSummary | null;
  @prop declare scope?: PluginConsentScope;
  @prop declare onClose: () => void;
  /** Called after the plugin was approved and turned on. */
  @prop declare onApproved: (slug: string) => void;

  @state acknowledged = false;
  @state busy = false;
  @state error = '';
  @state shown: IPluginConsentSummary | null = null;

  componentDidMount(): void {
    this.sync(null);
  }

  componentDidUpdate(previous: { summary: IPluginConsentSummary | null }): void {
    if (previous.summary !== this.summary) this.sync(previous.summary);
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
  }

  private sync(previous: IPluginConsentSummary | null): void {
    if (previous === this.summary) return;
    this.shown = this.summary;
    this.acknowledged = false;
    this.error = '';
    if (Platform.isBrowser) document.body.style.overflow = this.summary ? 'hidden' : 'unset';
  }

  @bound private async approve(): Promise<void> {
    const summary = this.shown;
    if (!summary || !this.acknowledged) return;
    this.busy = true;
    this.error = '';
    try {
      await PluginConsentRequest.approve(summary, this.scope ?? PluginConsentScope.PLATFORM);
      this.onApproved(summary.slug);
    } catch (error: unknown) {
      const changed = PluginConsentRequest.fromError(error);
      if (changed) {
        this.shown = changed;
        this.acknowledged = false;
        this.error = AdminI18n.t('plugins.consent.changed');
      } else {
        this.error = (error as { message?: string } | null)?.message || AdminI18n.t('plugins.consent.failed');
      }
    } finally {
      this.busy = false;
    }
  }

  @bound private acknowledge(checked: boolean): void {
    this.acknowledged = checked;
  }

  render(): ReactNode {
    const summary = this.shown;
    if (!summary) return null;
    const counts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    for (const entry of summary.entries) counts[entry.risk] = (counts[entry.risk] ?? 0) + 1;
    const added = summary.entries.filter((entry) => entry.isNew).length;

    // The console's dialog, not a window of its own: this one had its own backdrop blur, an indigo
    // shield tile, a close cross and two buttons stretched across its foot.
    const consent = AdminClass.of('consent');
    return (
      <Dialog
        wide
        isOpen
        onClose={this.onClose}
        busy={this.busy}
        title={AdminI18n.t('plugins.consent.title', { name: summary.name, version: summary.version })}
        description={AdminI18n.t('plugins.consent.description')}
        foot={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.onClose} disabled={this.busy}>{AdminI18n.t('common.cancel')}</Button>
            <Button variant={ButtonVariant.PRIMARY} onClick={this.approve} isLoading={this.busy} disabled={!this.acknowledged}>{AdminI18n.t('plugins.consent.approve')}</Button>
          </>
        )}
      >
        <div className={consent}>
          <p className={`${consent}__overview`}>
            {AdminI18n.t('plugins.consent.overview', { total: summary.entries.length, high: counts.high, medium: counts.medium, low: counts.low })}
            {added ? ` ${AdminI18n.t(added === 1 ? 'plugins.consent.overviewNewOne' : 'plugins.consent.overviewNewMany', { count: added })}` : ''}
          </p>
          <div className={`${consent}__list`}>
            {summary.entries.length
              ? <PluginConsentEntries entries={summary.entries} anyHostReason={summary.anyHostReason} />
              : <p className={`${consent}__text`}>{AdminI18n.t('plugins.consent.nothing')}</p>}
            <PluginConsentFacts summary={summary} />
          </div>
          {this.error ? <p role="alert" className={`${consent}__error`}>{this.error}</p> : null}
          {/* The same toggle the page itself uses for "Approve & enable": a yes/no is a switch in this admin. */}
          <div className={`${consent}__ack`}>
            <Switch checked={this.acknowledged} onChange={this.acknowledge} disabled={this.busy}
              label={AdminI18n.t('plugins.consent.acknowledge', { name: summary.name })} />
          </div>
        </div>
      </Dialog>
    );
  }
}
