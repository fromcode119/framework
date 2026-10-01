import { SystemConstants } from '@core/constants/system.constants';
import type { ConsentChannel } from '@core/notifications/enums/consent-channel.enum';
import type { NotificationCategory } from '@core/notifications/enums/notification-category.enum';

/**
 * A person's consents on this site (`_system_channel_consents`). A row is one agreement; withdrawing
 * deletes it. Every call names the person, so nobody can read or change another's.
 */
export class ChannelConsentStore {
  private static readonly TABLE = SystemConstants.TABLE.CHANNEL_CONSENTS;

  constructor(private readonly db: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  async forPerson(userId: number): Promise<Array<Record<string, any>>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (await this.db.find(ChannelConsentStore.TABLE, { where: { user_id: userId }, limit: 20 })) || [];
  }

  async find(userId: number, channel: ConsentChannel, category: NotificationCategory): Promise<Record<string, any> | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return await this.db.findOne(ChannelConsentStore.TABLE, { user_id: userId, channel: channel.value, category: category.value });
  }

  /** Record an agreement, replacing an earlier one for the same channel and category (a new number). */
  async grant(userId: number, channel: ConsentChannel, category: NotificationCategory, address: string, source: string): Promise<void> {
    await this.revoke(userId, channel, category);
    await this.db.insert(ChannelConsentStore.TABLE, { user_id: userId, channel: channel.value, category: category.value, address, source: source.slice(0, 120) });
  }

  async revoke(userId: number, channel: ConsentChannel, category: NotificationCategory): Promise<void> {
    await this.db.delete(ChannelConsentStore.TABLE, { user_id: userId, channel: channel.value, category: category.value });
  }

  /** Everyone on this site who agreed to `channel` at `address` stops getting it — a STOP reply. */
  async revokeAddress(channel: ConsentChannel, address: string): Promise<number> {
    const rows = (await this.db.find(ChannelConsentStore.TABLE, { where: { channel: channel.value, address }, limit: 100 })) || [];
    for (const row of rows) await this.db.delete(ChannelConsentStore.TABLE, { id: row.id });
    return rows.length;
  }
}
