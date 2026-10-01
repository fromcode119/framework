import { describe, expect, it } from 'vitest';
import { PersonNotifier } from '@core/notifications/person-notifier';
import { ChannelConsentStore } from '@core/notifications/channel-consent-store';
import { ConsentChannel } from '@core/notifications/enums/consent-channel.enum';
import { NotificationCategory } from '@core/notifications/enums/notification-category.enum';
import { PhoneNumber } from '@core/notifications/phone-number';
import { SmsContextProxy } from '@core/plugin/context/sms';
import { UnconfiguredSmsSender } from '@core/notifications/unconfigured-sms-sender';
import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';

/** A customer is texted only with their agreement, for that kind of message, at the number they gave. */
describe('telling a customer something', () => {
  class Db {
    rows: any[] = [];
    nextId = 1;
    private matches(row: any, where: any) { return Object.entries(where || {}).every(([k, v]) => row[k] === v); }
    async find(_t: string, opts: any) { return this.rows.filter((r) => this.matches(r, opts?.where)); }
    async findOne(_t: string, where: any) { return this.rows.find((r) => this.matches(r, where)) ?? null; }
    async insert(_t: string, data: any) { const row = { id: this.nextId++, ...data }; this.rows.push(row); return row; }
    async update(_t: string, where: any, data: any) { const row = this.rows.find((r) => this.matches(r, where)); if (row) Object.assign(row, data); return row; }
    async delete(_t: string, where: any) { this.rows = this.rows.filter((r) => !this.matches(r, where)); }
  }
  const setup = (sender: any = null) => {
    const sent: any[] = [];
    const providers: Record<string, any> = {};
    const db = new Db();
    const manager: any = {
      db,
      integrations: {
        get: async () => sender ?? new UnconfiguredSmsSender(),
        registerProvider: (_type: string, provider: any) => { providers[provider.key] = provider; },
      },
    };
    const configured = { configured: true, send: async (message: any) => { sent.push(message); return { id: 'm1' }; } };
    return { db, manager, sent, providers, configured, store: new ChannelConsentStore(db) };
  };

  it('accepts only an international number, never guessing a country', () => {
    expect(PhoneNumber.normalize('+359 88 (123) 45-67')).toBe('+359881234567');
    expect(PhoneNumber.normalize('00359881234567')).toBe('+359881234567');
    expect(PhoneNumber.normalize('0881234567')).toBe('');
    expect(PhoneNumber.normalize('+12')).toBe('');
  });

  it('texts an update only to someone who agreed to texted updates, at the number they agreed with', async () => {
    const fake = setup();
    const manager = { ...fake.manager, integrations: { ...fake.manager.integrations, get: async () => fake.configured } };
    const notifier = new PersonNotifier(manager);
    expect((await notifier.notify({ userId: 5, title: 'Shipped', category: NotificationCategory.UPDATES })).texted).toBe(false);
    await fake.store.grant(5, ConsentChannel.SMS, NotificationCategory.UPDATES, '+359881234567', 'test');
    expect((await notifier.notify({ userId: 5, title: 'Shipped', body: 'On its way', category: NotificationCategory.UPDATES })).texted).toBe(true);
    expect(fake.sent).toEqual([{ to: '+359881234567', body: 'Shipped\nOn its way' }]);
    // Agreeing to updates is not agreeing to offers.
    expect((await notifier.notify({ userId: 5, title: 'Sale', category: NotificationCategory.OFFERS })).texted).toBe(false);
  });

  it('sends no text while the site has no provider, whatever was agreed', async () => {
    const fake = setup();
    await fake.store.grant(5, ConsentChannel.SMS, NotificationCategory.UPDATES, '+359881234567', 'test');
    expect((await new PersonNotifier(fake.manager).notify({ userId: 5, title: 'Shipped', category: NotificationCategory.UPDATES })).texted).toBe(false);
  });

  it('a provider plugin is called with the site\'s settings, and a STOP withdraws every agreement for that number', async () => {
    const fake = setup();
    const calls: any[] = [];
    const sms = SmsContextProxy.createSmsProxy({ manifest: { namespace: 'org.test', slug: 'sms-test' } } as any, fake.manager);
    sms.registerProvider({ key: 'acme', label: 'Acme', fields: [{ name: 'token', label: 'Token', type: 'password' }], send: async (config, message) => { calls.push({ config, message }); return { id: 'x9' }; } });
    expect(fake.providers.acme.fields[0].type).toBe(IntegrationConfigFieldType.PASSWORD);
    const sender = fake.providers.acme.create({ token: 'secret' });
    expect(await sender.send({ to: '+359881234567', body: 'Hi' })).toEqual({ id: 'x9' });
    expect(calls).toEqual([{ config: { token: 'secret' }, message: { to: '+359881234567', body: 'Hi' } }]);
    expect(() => sms.registerProvider({ key: 'none', label: 'x', send: async () => ({ id: '' }) })).toThrow();

    // Its settings go back to the plugin that provides it, and to no other.
    const active = { ...fake.manager, integrations: { ...fake.manager.integrations, get: async () => sender } };
    expect(await SmsContextProxy.createSmsProxy({ manifest: { namespace: 'org.test', slug: 'sms-test' } } as any, active).activeSettings()).toEqual({ provider: 'acme', config: { token: 'secret' } });
    expect(await SmsContextProxy.createSmsProxy({ manifest: { namespace: 'org.test', slug: 'other' } } as any, active).activeSettings()).toBeNull();

    await fake.store.grant(5, ConsentChannel.SMS, NotificationCategory.UPDATES, '+359881234567', 'test');
    await fake.store.grant(5, ConsentChannel.SMS, NotificationCategory.OFFERS, '+359881234567', 'test');
    await fake.store.grant(6, ConsentChannel.SMS, NotificationCategory.UPDATES, '+447700900123', 'test');
    expect(await sms.optOut('+359 88 123 4567')).toEqual({ withdrawn: 2 });
    expect(fake.db.rows.map((r) => r.user_id)).toEqual([6]);
  });
});

describe('who a notice is for', () => {
  it('finds the account behind a sign-in email, and nobody behind an unknown one', async () => {
    const rows = [{ id: 12, email: 'ana@shop.test' }];
    const manager: any = { db: { findOne: async (_t: string, where: any) => rows.find((r) => r.email === where.email) ?? null } };
    const notifier = new PersonNotifier(manager);
    expect(await notifier.resolve({ email: ' Ana@Shop.test ' })).toBe(12);
    expect(await notifier.resolve({ email: 'nobody@shop.test' })).toBe(0);
    expect(await notifier.resolve({ userId: 7 })).toBe(7);
    expect(await notifier.resolve({})).toBe(0);
  });
});
