import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonNotifier, RequestContextUtils } from '@fromcode119/core';
import { PhoneVerificationService } from '@api/services/phone-verification-service';
import { SystemNotificationPreferencesController } from '@api/controllers/system/system-notification-preferences-controller';

/**
 * An agreement to texts names a number, and the site then texts it at its own cost. The number is
 * agreed to only after a code sent to it comes back.
 */
function managerWith(consents: any[] = []) {
  const meta = new Map<string, string>();
  const db = {
    findOne: vi.fn(async (_table: string, where: any) => (meta.has(where.key) ? { key: where.key, value: meta.get(where.key) } : null)),
    insert: vi.fn(async (table: string, row: any) => { if (row.key) meta.set(row.key, row.value); else consents.push(row); return row; }),
    update: vi.fn(async (_table: string, where: any, patch: any) => { meta.set(where.key, patch.value); return patch; }),
    delete: vi.fn(async () => true),
    find: vi.fn(async () => consents),
  };
  return { manager: { db } as any, meta, consents };
}

const sentTexts: Array<{ to: string; body: string }> = [];
const sender = { configured: true, send: vi.fn(async (message: { to: string; body: string }) => { sentTexts.push(message); return { id: 'x' }; }) };
const codeIn = (body: string) => String(body.match(/\d{6}/)?.[0] ?? '');

function response() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

afterEach(() => { vi.restoreAllMocks(); sentTexts.length = 0; });

/** Every call runs inside a request on a site, as it does in the api. */
const inRequest = <T>(work: () => Promise<T>): Promise<T> => RequestContextUtils.storage.run({ tenantId: 'shop' } as any, work);

describe('PhoneVerificationService', () => {
  it('confirms the code it texted, once', () => inRequest(async () => {
    const { manager } = managerWith();
    const verification = new PhoneVerificationService(manager);
    await verification.start(7, '+359881234567', sender);
    const code = codeIn(sentTexts[0].body);
    expect(code).toHaveLength(6);
    expect(await verification.confirm(7, '+359881234567', code)).toBe(true);
    expect(await verification.confirm(7, '+359881234567', code)).toBe(false);
  }));

  it('refuses the code for another number, and stops after five wrong tries', () => inRequest(async () => {
    const { manager } = managerWith();
    const verification = new PhoneVerificationService(manager);
    await verification.start(7, '+359881234567', sender);
    const code = codeIn(sentTexts[0].body);
    expect(await verification.confirm(7, '+359889999999', code)).toBe(false);
    for (let i = 0; i < 5; i += 1) await verification.confirm(7, '+359881234567', '000000' === code ? '111111' : '000000');
    expect(await verification.confirm(7, '+359881234567', code)).toBe(false);
  }));
});

describe('agreeing to texts', () => {
  const request = (body: Record<string, unknown>) => ({ user: { id: '7' }, body }) as any;

  it('texts a code instead of recording the agreement, then records it with the code', () => inRequest(async () => {
    vi.spyOn(PersonNotifier.prototype, 'sender').mockResolvedValue(sender as any);
    const { manager, consents } = managerWith();
    const controller = new SystemNotificationPreferencesController(manager);

    const first = response();
    await controller.update(request({ channel: 'sms', category: 'updates', enabled: true, phone: '+359 88 123 4567' }), first);
    expect(first.body).toEqual({ verificationRequired: true, phone: '+359881234567' });
    expect(consents).toHaveLength(0);

    const wrong = response();
    await controller.update(request({ channel: 'sms', category: 'updates', enabled: true, phone: '+359 88 123 4567', code: '12' }), wrong);
    expect(wrong.statusCode).toBe(400);

    const second = response();
    await controller.update(request({ channel: 'sms', category: 'updates', enabled: true, phone: '+359 88 123 4567', code: codeIn(sentTexts[0].body) }), second);
    expect(second.body).toEqual({ success: true });
    expect(consents).toHaveLength(1);
  }));

  it('needs no second code for a number this person already confirmed', () => inRequest(async () => {
    vi.spyOn(PersonNotifier.prototype, 'sender').mockResolvedValue(sender as any);
    const { manager } = managerWith([{ user_id: 7, channel: 'sms', category: 'updates', address: '+359881234567' }]);
    const res = response();
    await new SystemNotificationPreferencesController(manager).update(request({ channel: 'sms', category: 'offers', enabled: true, phone: '+359881234567' }), res);
    expect(res.body).toEqual({ success: true });
    expect(sentTexts).toHaveLength(0);
  }));
});
