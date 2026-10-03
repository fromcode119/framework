import type { ReactNode } from 'react';
import { prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Checkbox } from '@/components/ui/view/checkbox.client';
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

    return (
      <RootFramework>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="plugin-consent-title">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={this.busy ? undefined : this.onClose} />
          <div className={`relative w-full max-w-2xl my-auto ${AdminClass.SURFACE} p-5 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300`}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg flex-shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <FrameworkIcons.ShieldCheck size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="plugin-consent-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white break-words">
                  {AdminI18n.t('plugins.consent.title', { name: summary.name, version: summary.version })}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {AdminI18n.t('plugins.consent.description')}
                </p>
              </div>
              <button type="button" onClick={this.onClose} disabled={this.busy} aria-label={AdminI18n.t('common.close')}
                className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white">
                <FrameworkIcons.Close size={20} />
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
              {AdminI18n.t('plugins.consent.overview', { total: summary.entries.length, high: counts.high, medium: counts.medium, low: counts.low })}
              {added ? ` ${AdminI18n.t('plugins.consent.overviewNew', { count: added })}` : ''}
            </p>

            <div className="mt-4 space-y-6 max-h-[52vh] overflow-auto pr-1">
              {summary.entries.length
                ? <PluginConsentEntries entries={summary.entries} anyHostReason={summary.anyHostReason} />
                : <p className="text-sm text-slate-600 dark:text-slate-400">{AdminI18n.t('plugins.consent.nothing')}</p>}
              <PluginConsentFacts summary={summary} />
            </div>

            {this.error ? (
              <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {this.error}
              </p>
            ) : null}

            <div className="mt-5">
              <Checkbox checked={this.acknowledged} onChange={this.acknowledge} disabled={this.busy}
                label={AdminI18n.t('plugins.consent.acknowledge', { name: summary.name })} />
            </div>

            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-3">
              <Button variant={ButtonVariant.GHOST} className="flex-1" onClick={this.onClose} disabled={this.busy}>
                {AdminI18n.t('common.cancel')}
              </Button>
              <Button variant={ButtonVariant.PRIMARY} className="flex-1" onClick={this.approve} isLoading={this.busy} disabled={!this.acknowledged}>
                {AdminI18n.t('plugins.consent.approve')}
              </Button>
            </div>
          </div>
        </div>
      </RootFramework>
    );
  }
}
