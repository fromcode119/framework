import { describe, expect, it, vi } from 'vitest';
import { EmailBounceReader } from '@core/email/email-bounce-reader';
import { EmailSuppressionService } from '@core/email/email-suppression-service';

const db = (rows: any[]) => ({
  find: vi.fn(async (_table: string, opts: any) => rows.filter((row) => Object.entries(opts.where).every(([k, v]) => row[k] === v)).slice(0, opts.limit ?? 1000)),
  update: vi.fn(async (_table: string, where: any, patch: any) => { Object.assign(rows.find((row) => row.id === where.id), patch); }),
});

const bounce = (originalMessageId: string, address = 'gone@example.org') => ({
  complaint: false,
  originalMessageId,
  recipients: [{ address, action: 'failed', status: '5.1.1', diagnostic: 'smtp; 550 User unknown' }],
});

/** A bounce mailbox anyone can write to: only a report about an email we sent may change anything. */
describe('EmailBounceReader.apply', () => {
  it('marks the matching email bounced and stops mailing the address', async () => {
    const rows = [{ id: 1, to_address: 'gone@example.org', message_id: 'abc@shop.example', status: 'sent' }];
    const suppress = vi.spyOn(EmailSuppressionService, 'suppress').mockResolvedValue();
    const changed = await new EmailBounceReader(db(rows), async () => []).apply(bounce('abc@shop.example'));
    expect(changed).toBe(1);
    expect(rows[0]).toMatchObject({ status: 'bounced', error: '5.1.1 — smtp; 550 User unknown' });
    expect(suppress).toHaveBeenCalledWith(expect.anything(), 'gone@example.org', EmailSuppressionService.ALL, 'bounce');
    suppress.mockRestore();
  });

  it('does nothing for a report about an email this site never sent to that address', async () => {
    const rows = [{ id: 1, to_address: 'customer@example.org', message_id: 'abc@shop.example', status: 'sent' }];
    const suppress = vi.spyOn(EmailSuppressionService, 'suppress').mockResolvedValue();
    const reader = new EmailBounceReader(db(rows), async () => []);
    expect(await reader.apply(bounce('abc@shop.example'))).toBe(0);
    expect(await reader.apply(bounce('', 'customer@example.org'))).toBe(0);
    expect(rows[0].status).toBe('sent');
    expect(suppress).not.toHaveBeenCalled();
    suppress.mockRestore();
  });

  it('does nothing when the reported email went to several people', async () => {
    const rows = [
      { id: 1, to_address: 'a@example.org', message_id: 'shared@shop.example', status: 'sent' },
      { id: 2, to_address: 'b@example.org', message_id: 'shared@shop.example', status: 'sent' },
    ];
    const suppress = vi.spyOn(EmailSuppressionService, 'suppress').mockResolvedValue();
    expect(await new EmailBounceReader(db(rows), async () => []).apply(bounce('shared@shop.example', 'b@example.org'))).toBe(0);
    expect(suppress).not.toHaveBeenCalled();
    suppress.mockRestore();
  });
});
