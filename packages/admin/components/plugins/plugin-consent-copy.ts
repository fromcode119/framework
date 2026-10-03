import type { IPluginConsentEntry } from '@/components/plugins/interfaces/plugin-consent-entry.interface';
import type { IPluginConsentCopy } from '@/components/plugins/interfaces/plugin-consent-copy.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The words the consent dialog shows for each entry. Every key is written out, so the console's
 * dictionaries and their guard can see each one; an entry with no description says so plainly
 * instead of inventing one.
 */
export class PluginConsentCopy {
  private static readonly HOST = 'host';
  private static readonly ANY_HOST = 'anyHost';
  private static readonly INTEGRATION_PREFIX = 'integration:';

  static of(entry: IPluginConsentEntry, anyHostReason: string): IPluginConsentCopy {
    if (entry.kind === PluginConsentCopy.HOST) {
      return { title: AdminI18n.t('plugins.consent.entry.host.title', { host: entry.host }), detail: AdminI18n.t('plugins.consent.entry.host.detail') };
    }
    if (entry.kind === PluginConsentCopy.ANY_HOST) {
      return {
        title: AdminI18n.t('plugins.consent.entry.anyHost.title'),
        detail: anyHostReason
          ? AdminI18n.t('plugins.consent.entry.anyHost.detail', { reason: anyHostReason })
          : AdminI18n.t('plugins.consent.entry.anyHost.noReason'),
      };
    }
    if (entry.entry.startsWith(PluginConsentCopy.INTEGRATION_PREFIX)) {
      const name = entry.entry.slice(PluginConsentCopy.INTEGRATION_PREFIX.length).replace(/_/g, ' ');
      return { title: AdminI18n.t('plugins.consent.entry.integration.title', { name }), detail: AdminI18n.t('plugins.consent.entry.integration.detail') };
    }
    return PluginConsentCopy.capabilities().get(entry.entry)
      ?? { title: AdminI18n.t('plugins.consent.entry.unknown.title', { entry: entry.entry }), detail: AdminI18n.t('plugins.consent.entry.unknown.detail') };
  }

  private static capabilities(): Map<string, IPluginConsentCopy> {
    return new Map<string, IPluginConsentCopy>([
    ['api', { title: AdminI18n.t('plugins.consent.entry.api.title'), detail: AdminI18n.t('plugins.consent.entry.api.detail') }],
    ['api:routes', { title: AdminI18n.t('plugins.consent.entry.apiRoutes.title'), detail: AdminI18n.t('plugins.consent.entry.apiRoutes.detail') }],
    ['admin', { title: AdminI18n.t('plugins.consent.entry.admin.title'), detail: AdminI18n.t('plugins.consent.entry.admin.detail') }],
    ['content', { title: AdminI18n.t('plugins.consent.entry.content.title'), detail: AdminI18n.t('plugins.consent.entry.content.detail') }],
    ['database', { title: AdminI18n.t('plugins.consent.entry.database.title'), detail: AdminI18n.t('plugins.consent.entry.database.detail') }],
    ['database:read', { title: AdminI18n.t('plugins.consent.entry.databaseRead.title'), detail: AdminI18n.t('plugins.consent.entry.databaseRead.detail') }],
    ['database:write', { title: AdminI18n.t('plugins.consent.entry.databaseWrite.title'), detail: AdminI18n.t('plugins.consent.entry.databaseWrite.detail') }],
    ['database:schema', { title: AdminI18n.t('plugins.consent.entry.databaseSchema.title'), detail: AdminI18n.t('plugins.consent.entry.databaseSchema.detail') }],
    ['database:raw', { title: AdminI18n.t('plugins.consent.entry.databaseRaw.title'), detail: AdminI18n.t('plugins.consent.entry.databaseRaw.detail') }],
    ['database:schema:cross-plugin', { title: AdminI18n.t('plugins.consent.entry.databaseSchemaCrossPlugin.title'), detail: AdminI18n.t('plugins.consent.entry.databaseSchemaCrossPlugin.detail') }],
    ['database:*', { title: AdminI18n.t('plugins.consent.entry.databaseAll.title'), detail: AdminI18n.t('plugins.consent.entry.databaseAll.detail') }],
    ['email', { title: AdminI18n.t('plugins.consent.entry.email.title'), detail: AdminI18n.t('plugins.consent.entry.email.detail') }],
    ['filesystem:read', { title: AdminI18n.t('plugins.consent.entry.filesystemRead.title'), detail: AdminI18n.t('plugins.consent.entry.filesystemRead.detail') }],
    ['filesystem:write', { title: AdminI18n.t('plugins.consent.entry.filesystemWrite.title'), detail: AdminI18n.t('plugins.consent.entry.filesystemWrite.detail') }],
    ['frontend', { title: AdminI18n.t('plugins.consent.entry.frontend.title'), detail: AdminI18n.t('plugins.consent.entry.frontend.detail') }],
    ['hooks', { title: AdminI18n.t('plugins.consent.entry.hooks.title'), detail: AdminI18n.t('plugins.consent.entry.hooks.detail') }],
    ['i18n', { title: AdminI18n.t('plugins.consent.entry.i18n.title'), detail: AdminI18n.t('plugins.consent.entry.i18n.detail') }],
    ['integrations', { title: AdminI18n.t('plugins.consent.entry.integrations.title'), detail: AdminI18n.t('plugins.consent.entry.integrations.detail') }],
    ['network', { title: AdminI18n.t('plugins.consent.entry.network.title'), detail: AdminI18n.t('plugins.consent.entry.network.detail') }],
    ['plugins:interact', { title: AdminI18n.t('plugins.consent.entry.pluginsInteract.title'), detail: AdminI18n.t('plugins.consent.entry.pluginsInteract.detail') }],
    ['extensions:manage', { title: AdminI18n.t('plugins.consent.entry.extensionsManage.title'), detail: AdminI18n.t('plugins.consent.entry.extensionsManage.detail') }],
    ['cache', { title: AdminI18n.t('plugins.consent.entry.cache.title'), detail: AdminI18n.t('plugins.consent.entry.cache.detail') }],
    ['jobs', { title: AdminI18n.t('plugins.consent.entry.jobs.title'), detail: AdminI18n.t('plugins.consent.entry.jobs.detail') }],
    ['scheduler', { title: AdminI18n.t('plugins.consent.entry.scheduler.title'), detail: AdminI18n.t('plugins.consent.entry.scheduler.detail') }],
    ['redis:global', { title: AdminI18n.t('plugins.consent.entry.redisGlobal.title'), detail: AdminI18n.t('plugins.consent.entry.redisGlobal.detail') }],
    ['settings', { title: AdminI18n.t('plugins.consent.entry.settings.title'), detail: AdminI18n.t('plugins.consent.entry.settings.detail') }],
    ['storage', { title: AdminI18n.t('plugins.consent.entry.storage.title'), detail: AdminI18n.t('plugins.consent.entry.storage.detail') }],
    ['*', { title: AdminI18n.t('plugins.consent.entry.everything.title'), detail: AdminI18n.t('plugins.consent.entry.everything.detail') }],
    ]);
  }
}
