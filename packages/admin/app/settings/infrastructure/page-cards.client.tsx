import { SystemConstants } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { Explanation } from '@/components/ui/view/explanation.client';
import { Select } from '@/components/ui/view/select.client';
import { InfrastructureSettingsPageActions } from '@/app/settings/infrastructure/page-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { JobRunRetentionRow } from '@/app/settings/infrastructure/job-run-retention-row.client';

/**
 * The four cards this screen is made of.
 *
 * One method each, because they are four independent settings groups with four independent saves —
 * and because a card that has nothing to say yet returns `null` rather than rendering an empty
 * control that states something the platform has not confirmed.
 */
export abstract class InfrastructureSettingsPageCards extends InfrastructureSettingsPageActions {
  /**
   * Maintenance mode — the one switch that takes the whole deployment offline.
   *
   * This card used to be a "Pulse Monitor" asserting Database=Healthy and API Clusters=Online with
   * pulsing green dots. Nothing measured either one — the page only loads the `maintenance_mode`
   * setting — so both rows were removed rather than left as decoration. A real probe belongs here
   * only once something actually polls it.
   *
   * Nothing is rendered until the setting has loaded: an unchecked switch would state the
   * deployment is live before anything has asked.
   */
  protected maintenanceCard(): ReactNode {
    if (this.maintenance === null) return null;
    const theme = this.theme;
    return (
          <Card title={AdminI18n.t('settings.infrastructure.maintenance')}>
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Activity}
              title={AdminI18n.t('settings.infrastructure.maintenanceMode')}
              description={AdminI18n.t('settings.infrastructure.restrictsFrontendAccessWhileYou')}
            >
              <Switch checked={this.maintenance} onChange={this.toggleMaintenance} />
            </SettingRow>
          </Card>
    );
  }

  /**
   * How much of the box a theme world may take, and how many stay resident.
   *
   * One theme+plugin version set is one server-render "world" resident in the storefront process.
   * On a multi-tenant deployment several are live at once — one per distinct set, NOT per site — and
   * the cap is how many stay resident before the least recently used is dropped and rebuilt on
   * demand. Each placeholder is the storefront's own default, stated once in SystemConstants.
   *
   * T5b: a theme world is a PROCESS with no secrets in its environment, a heap ceiling and a
   * per-render deadline. A theme that leaks or hangs loses its own process, never the storefront.
   */
  protected serverRenderingCard(): ReactNode {
    const theme = this.theme;
    return (
        <Card title={AdminI18n.t('settings.infrastructure.serverRendering')}>
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Layers}
            title={AdminI18n.t('settings.infrastructure.residentThemeWorlds')}
            stacked
            description={AdminI18n.t('settings.infrastructure.howManyDistinctThemePlugin')}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper
                  min={1}
                  step={1}
                  value={this.ssrGenerationCap}
                  onChange={this.onSsrCapChange}
                  placeholder={AdminI18n.t('settings.infrastructure.default5', { SSR_GENERATION_CAP_DEFAULT: SystemConstants.SSR_GENERATION_CAP_DEFAULT })}
                />
              </div>
            </div>
          </SettingRow>
          {/* T5b: a theme world is a PROCESS with no secrets in its environment, a heap ceiling and a
              per-render deadline. A theme that leaks or hangs loses its own process, never the storefront. */}
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Database}
            title={AdminI18n.t('settings.infrastructure.memoryCeilingPerRenderProcess')}
            stacked
            description={AdminI18n.t('settings.infrastructure.aThemeWorldThatAllocates')}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper min={128} step={64} value={this.ssrRenderMemoryMb} onChange={this.onSsrRenderMemory} placeholder={AdminI18n.t('settings.infrastructure.default6', { SSR_RENDER_MEMORY_MB_DEFAULT: SystemConstants.SSR_RENDER_MEMORY_MB_DEFAULT })} />
              </div>
            </div>
          </SettingRow>
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Clock}
            title={AdminI18n.t('settings.infrastructure.deadlinePerRenderMs')}
            stacked
            description={AdminI18n.t('settings.infrastructure.aPageRenderThatDoes')}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper min={1000} step={1000} value={this.ssrRenderTimeoutMs} onChange={this.onSsrRenderTimeout} placeholder={AdminI18n.t('settings.infrastructure.default7', { SSR_RENDER_TIMEOUT_MS_DEFAULT: SystemConstants.SSR_RENDER_TIMEOUT_MS_DEFAULT })} />
              </div>
              <Button
                onClick={this.saveSsrCap}
                isLoading={this.isSavingSsrCap}
                icon={<FrameworkIcons.Save size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                {AdminI18n.t('settings.infrastructure.save')}
              </Button>
            </div>
          </SettingRow>
        </Card>
    );
  }

  /**
   * How long the system log and the audit journal are kept.
   *
   * `_system_logs` had no retention of any kind, so it grew without bound and a permanent WARN
   * stream buried the warnings worth reading. The window is declared HERE and nowhere else: blank or
   * 0 keeps everything, and the platform prunes only what this field asks for — there is no
   * code-level default quietly deleting an operator's history.
   */
  protected retentionCard(): ReactNode {
    const theme = this.theme;
    return (
        <Card title={AdminI18n.t('settings.infrastructure.retention')}>
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Database}
            title={AdminI18n.t('settings.infrastructure.logRetention')}
            stacked
            description={AdminI18n.t('settings.infrastructure.daysOfSystemLogHistory')}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper
                  min={0}
                  step={1}
                  value={this.logRetentionDays}
                  onChange={this.onRetentionChange}
                  placeholder={AdminI18n.t('settings.infrastructure.keepForever')}
                />
              </div>
              <Button
                onClick={this.saveRetention}
                isLoading={this.isSavingRetention}
                icon={<FrameworkIcons.Save size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                {AdminI18n.t('settings.infrastructure.save')}
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Shield}
            title={AdminI18n.t('settings.infrastructure.auditRetention')}
            stacked
            description={AdminI18n.t('settings.infrastructure.daysOfAuditHistoryTo')}
            explanation={(
              <Explanation>
                <p>
                  <AdminRichText k="settings.infrastructure.auditTrailNotLog" />
                </p>
                <p>
                  <AdminRichText k="settings.infrastructure.auditMinimum" />
                </p>
                <p>{AdminI18n.t('settings.infrastructure.eachPruneIsItselfWritten')}</p>
              </Explanation>
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper
                  min={0}
                  step={1}
                  value={this.auditRetentionDays}
                  onChange={this.onAuditRetentionChange}
                  placeholder={AdminI18n.t('settings.infrastructure.keepForever')}
                />
              </div>
              <Button
                onClick={this.saveAuditRetention}
                isLoading={this.isSavingAuditRetention}
                icon={<FrameworkIcons.Save size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                {AdminI18n.t('settings.infrastructure.save')}
              </Button>
            </div>
          </SettingRow>

          <JobRunRetentionRow />
        </Card>
    );
  }
}
