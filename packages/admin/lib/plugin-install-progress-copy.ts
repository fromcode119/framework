import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';

/**
 * An install or update's progress in the console's language. The api reports each step in English
 * for its log, plus a `messageKey` and the values it names; the console words it from
 * `plugins.installProgress.<messageKey>`. A step without a key — or one the dictionary lacks —
 * shows the api's own words, so nothing a step reports is ever lost.
 */
export class PluginInstallProgressCopy {
  static localize(operation: IPluginInstallOperation): IPluginInstallOperation {
    if (!operation?.messageKey) return operation;
    const key = `plugins.installProgress.${operation.messageKey}`;
    if (!AdminI18n.optional(key)) return operation;
    return { ...operation, message: AdminI18n.t(key, operation.messageParams || {}) };
  }
}
