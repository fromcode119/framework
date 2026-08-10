import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailSuppressionService } from '@core/email/email-suppression-service';
import { SuppressedEmailDriver } from '@core/email/suppressed-email-driver';

/**
 * One do-not-email list for the whole install, enforced where mail leaves.
 *
 * Checking an opt-out in every caller that sends mail fails the same way every time — one of them
 * forgets, and the only person who notices is the recipient who asked not to be contacted.
 *
 * The category rules carry the weight here. A blunt list would silence order confirmations for anyone
 * who unsubscribed from a review invitation, which trades one complaint for a worse one.
 */
describe('EmailSuppressionService', () => {
  let rows: any[];
  const db = {
    find: async (_t: string, opts: any) => rows.filter((r) =>
      Object.entries(opts?.where || {}).every(([k, v]) => r[k] === v)),
    insert: async (_t: string, row: any) => { rows.push(row); },
    delete: async (_t: string, where: any) => {
      rows = rows.filter((r) => !Object.entries(where).every(([k, v]) => r[k] === v));
    },
  };

  beforeEach(() => { rows = []; });

  it('an "all" suppression blocks every stream, transactional included', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', EmailSuppressionService.ALL, 'test');
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com')).toBe(true);
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com', 'review-invitation')).toBe(true);
  });

  it('a category suppression blocks THAT stream only', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'review-invitation', 'test');
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com', 'review-invitation')).toBe(true);
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com', 'newsletter')).toBe(false);
  });

  it('an order confirmation still reaches someone who left a marketing stream', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'review-invitation', 'test');
    // No category = transactional.
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com')).toBe(false);
  });

  it('matches regardless of case or surrounding space', async () => {
    await EmailSuppressionService.suppress(db, '  A@Example.COM ', 'newsletter', 'test');
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com', 'NEWSLETTER')).toBe(true);
  });

  it('recording the same opt-out twice does not duplicate it', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'newsletter', 'link');
    await EmailSuppressionService.suppress(db, 'a@example.com', 'newsletter', 'link');
    expect(rows).toHaveLength(1);
  });

  it('unsuppress restores just that stream', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'newsletter', 'link');
    await EmailSuppressionService.unsuppress(db, 'a@example.com', 'newsletter');
    expect(await EmailSuppressionService.isSuppressed(db, 'a@example.com', 'newsletter')).toBe(false);
  });

  it('an unreadable table does not silently stop all email', async () => {
    const broken = { find: async () => { throw new Error('db down'); } } as any;
    expect(await EmailSuppressionService.isSuppressed(broken, 'a@example.com', 'newsletter')).toBe(false);
  });
});

describe('SuppressedEmailDriver — enforcement at the send layer', () => {
  let rows: any[];
  let sent: any[];
  const db = {
    find: async (_t: string, opts: any) => rows.filter((r) =>
      Object.entries(opts?.where || {}).every(([k, v]) => r[k] === v)),
    insert: async (_t: string, row: any) => { rows.push(row); },
  };
  const inner = { send: async (o: any) => { sent.push(o); return { ok: true }; } };

  beforeEach(() => { rows = []; sent = []; });

  it('sends normally when nobody is suppressed', async () => {
    await SuppressedEmailDriver.wrap(inner as any, db).send({ to: 'a@example.com', subject: 'Hi' });
    expect(sent).toHaveLength(1);
  });

  it('refuses a suppressed recipient and reports the skip rather than claiming success', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'review-invitation', 'link');
    const result: any = await SuppressedEmailDriver.wrap(inner as any, db)
      .send({ to: 'a@example.com', subject: 'Review?', category: 'review-invitation' } as any);
    expect(sent).toHaveLength(0);
    expect(result.skipped).toBe(true);
  });

  it('drops only the opted-out recipient from a multi-address send', async () => {
    await EmailSuppressionService.suppress(db, 'b@example.com', EmailSuppressionService.ALL, 'link');
    await SuppressedEmailDriver.wrap(inner as any, db)
      .send({ to: ['a@example.com', 'b@example.com', 'c@example.com'], subject: 'Hi' });
    expect(sent[0].to).toEqual(['a@example.com', 'c@example.com']);
  });

  it('still delivers a transactional message to someone who left a marketing stream', async () => {
    await EmailSuppressionService.suppress(db, 'a@example.com', 'review-invitation', 'link');
    await SuppressedEmailDriver.wrap(inner as any, db).send({ to: 'a@example.com', subject: 'Your order' });
    expect(sent).toHaveLength(1);
  });
});
