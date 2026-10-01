import type { Request, Response } from 'express';
import { ChannelConsentStore, ConsentChannel, NotificationCategory, PersonNotifier, PhoneNumber, SystemConstants } from '@fromcode119/core';

/**
 * What a person agreed to be sent outside the site — texts for updates and for offers, and offers as
 * notifications. The person is ALWAYS the session's, as on the email preferences screen.
 *
 * Texts are offered only when the site has a provider set up, and an agreement to them keeps the
 * number it was given for, in international form — the number is never guessed from a local one.
 */
export class SystemNotificationPreferencesController {
  private static readonly SOURCE = 'account:notifications';

  constructor(private readonly manager: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  private get consents(): ChannelConsentStore {
    return new ChannelConsentStore(this.manager.db);
  }

  async list(req: Request, res: Response): Promise<void> {
    await this.run(res, async () => {
      const userId = SystemNotificationPreferencesController.userId(req);
      const rows = await this.consents.forPerson(userId);
      const has = (channel: ConsentChannel, category: NotificationCategory) => rows.find((row) => row.channel === channel.value && row.category === category.value);
      const smsRow = has(ConsentChannel.SMS, NotificationCategory.UPDATES) ?? has(ConsentChannel.SMS, NotificationCategory.OFFERS);
      return {
        sms: {
          available: (await new PersonNotifier(this.manager).sender()).configured,
          phone: String(smsRow?.address ?? '') || await this.profilePhone(userId),
          updates: Boolean(has(ConsentChannel.SMS, NotificationCategory.UPDATES)),
          offers: Boolean(has(ConsentChannel.SMS, NotificationCategory.OFFERS)),
        },
        push: { offers: Boolean(has(ConsentChannel.PUSH, NotificationCategory.OFFERS)) },
      };
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    await this.run(res, async () => {
      const userId = SystemNotificationPreferencesController.userId(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const channel = ConsentChannel.fromValue(String(body.channel ?? '')) as ConsentChannel | undefined;
      const category = NotificationCategory.fromValue(String(body.category ?? '')) as NotificationCategory | undefined;
      // Push updates are the device switch itself; only these three are agreements recorded here.
      if (!channel || !category || (channel === ConsentChannel.PUSH && category !== NotificationCategory.OFFERS)) {
        throw Object.assign(new Error('Unknown notification preference'), { status: 400 });
      }
      if (body.enabled !== true) {
        await this.consents.revoke(userId, channel, category);
        return { success: true };
      }
      let address = '';
      if (channel === ConsentChannel.SMS) {
        if (!(await new PersonNotifier(this.manager).sender()).configured) throw Object.assign(new Error('Text messages are not available on this site'), { status: 409 });
        address = PhoneNumber.normalize(body.phone);
        if (!address) throw Object.assign(new Error('Enter your number with its country code, for example +359 88 123 4567'), { status: 400 });
      }
      await this.consents.grant(userId, channel, category, address, SystemNotificationPreferencesController.SOURCE);
      return { success: true };
    });
  }

  /** The phone on the person's own record, offered as a starting point — never used without agreement. */
  private async profilePhone(userId: number): Promise<string> {
    const person = await this.manager.db.findOne(SystemConstants.TABLE.PEOPLE, { user_id: userId }).catch(() => null);
    return String(person?.phone ?? '');
  }

  private static userId(req: Request): number {
    const id = Number((req as any).user?.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!Number.isFinite(id) || id <= 0) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    return id;
  }

  private async run(res: Response, work: () => Promise<unknown>): Promise<void> {
    try {
      res.json(await work());
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      res.status(err?.status ?? 500).json({ error: err?.message ?? 'Internal server error' });
    }
  }
}
