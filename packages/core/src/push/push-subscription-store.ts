import { SystemConstants } from '@core/constants/system.constants';
import { PushSurface } from '@core/push/enums/push-surface.enum';

/**
 * A person's push devices on this site (`_system_push_subscriptions`). Every read and write names the
 * person, so one person can never list or remove another's device; the table's row-level policy keeps
 * each site to its own rows.
 */
export class PushSubscriptionStore {
  /** A device that keeps failing is let go rather than retried forever. */
  static readonly MAX_FAILURES = 5;
  private static readonly PER_PERSON_LIMIT = 50;
  private static readonly TABLE = SystemConstants.TABLE.PUSH_SUBSCRIPTIONS;

  constructor(private readonly db: any) {}

  /** Keep `subscription` for `userId`. A browser that subscribes again replaces its row, whoever held it. */
  async save(userId: number, surface: PushSurface, subscription: { endpoint: string; p256dh: string; auth: string }, label: string): Promise<void> {
    const row = { user_id: userId, surface: surface.value, p256dh: subscription.p256dh, auth: subscription.auth, label: label.slice(0, 120), failures: 0 };
    const existing = await this.db.findOne(PushSubscriptionStore.TABLE, { endpoint: subscription.endpoint });
    if (existing) await this.db.update(PushSubscriptionStore.TABLE, { id: existing.id }, row);
    else await this.db.insert(PushSubscriptionStore.TABLE, { ...row, endpoint: subscription.endpoint });
  }

  async forPerson(userId: number, surface?: PushSurface): Promise<Array<Record<string, any>>> {
    const where: Record<string, unknown> = { user_id: userId };
    if (surface) where.surface = surface.value;
    return (await this.db.find(PushSubscriptionStore.TABLE, { where, orderBy: { id: 'desc' }, limit: PushSubscriptionStore.PER_PERSON_LIMIT })) || [];
  }

  /** Forget one device of `userId` — by its endpoint, which only that browser knows. */
  async remove(userId: number, endpoint: string): Promise<void> {
    await this.db.delete(PushSubscriptionStore.TABLE, { user_id: userId, endpoint });
  }

  async delivered(id: number): Promise<void> {
    await this.db.update(PushSubscriptionStore.TABLE, { id }, { failures: 0, last_sent_at: new Date().toISOString() });
  }

  /** The push service says this device is gone, or it failed once too often: stop sending to it. */
  async failed(row: Record<string, any>, gone: boolean): Promise<void> {
    const failures = Number(row.failures ?? 0) + 1;
    if (gone || failures >= PushSubscriptionStore.MAX_FAILURES) await this.db.delete(PushSubscriptionStore.TABLE, { id: row.id });
    else await this.db.update(PushSubscriptionStore.TABLE, { id: row.id }, { failures });
  }
}
