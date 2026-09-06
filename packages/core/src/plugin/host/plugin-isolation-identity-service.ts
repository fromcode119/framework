import { SystemConstants } from '@core/constants/system.constants';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';

/**
 * Which OS user an isolated plugin runs as — `PLUGIN_UID_BASE` plus a number that is assigned on the
 * plugin's first isolated start and then never changes (`_system_plugins.isolation_uid`).
 *
 * Stable on purpose: the plugin's data directory is owned by that user, so a plugin that came back
 * as a different number after a restart would find its own files unreadable. Assignments are
 * serialised so two plugins starting together cannot both take the next free number.
 */
export class PluginIsolationIdentityService {
  private queue: Promise<unknown> = Promise.resolve();

  /** A GETTER: the registry is built before the manager has its database; the first lookup comes after. */
  constructor(private readonly database: () => {
    findOne(table: string, where: Record<string, unknown>): Promise<any>;
    find(table: string, options?: Record<string, unknown>): Promise<any[]>;
    update(table: string, where: Record<string, unknown>, values: Record<string, unknown>): Promise<unknown>;
  }) {}

  identityFor(slug: string): Promise<IGuestIdentity> {
    const next = this.queue.then(() => this.resolve(slug));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async resolve(slug: string): Promise<IGuestIdentity> {
    const db = this.database();
    const row = await db.findOne(SystemConstants.TABLE.PLUGINS, { slug: slug.toLowerCase() });
    const existing = Number(row?.isolation_uid);
    if (Number.isFinite(existing) && existing > 0) return { uid: existing, gid: existing };

    const rows = await db.find(SystemConstants.TABLE.PLUGINS, {});
    const taken = rows.map((entry) => Number(entry?.isolation_uid)).filter((value) => Number.isFinite(value) && value > 0);
    const uid = taken.length ? Math.max(...taken) + 1 : SystemConstants.PROCESS_ISOLATION.PLUGIN_UID_BASE;
    if (row) await db.update(SystemConstants.TABLE.PLUGINS, { slug: slug.toLowerCase() }, { isolation_uid: uid });
    return { uid, gid: uid };
  }
}
