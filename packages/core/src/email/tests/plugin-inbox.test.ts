import { beforeEach, describe, expect, it, vi } from 'vitest';

const reader = vi.hoisted(() => ({ fetch: vi.fn(async () => ({ uidValidity: '1', lastUid: 0, messages: [] })) }));
vi.mock('@fromcode119/email', () => ({ ImapInboxReader: reader }));
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => dns);

const { PluginInbox } = await import('@core/email/plugin-inbox');

/**
 * A plugin process has no network; the host reads a mailbox for it — public addresses and IMAP ports
 * only, after the same gate `context.fetch` passes.
 */
describe('PluginInbox', () => {
  const account = { host: 'Mail.Example.com', port: 993, secure: true, user: 'support@example.com', password: 'x' };
  beforeEach(() => { reader.fetch.mockClear(); dns.lookup.mockReset(); });

  it('connects to the resolved public address and checks the certificate against the name', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const gate = vi.fn(async () => undefined);
    await PluginInbox.fetch(account, { sinceUid: 7 }, gate);
    expect(gate).toHaveBeenCalledWith('imap://mail.example.com:993');
    expect(reader.fetch).toHaveBeenCalledWith(expect.objectContaining({ host: '93.184.216.34', servername: 'mail.example.com', port: 993, secure: true }), { sinceUid: 7 });
  });

  it('refuses a host that resolves to a private address, even partly', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    await expect(PluginInbox.fetch(account, {}, async () => undefined)).rejects.toThrow(/not a public address/);
    dns.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(PluginInbox.fetch({ ...account, host: 'localhost' }, {}, async () => undefined)).rejects.toThrow(/not a public address/);
    expect(reader.fetch).not.toHaveBeenCalled();
  });

  it('only IMAP ports, and STARTTLS on 143', async () => {
    await expect(PluginInbox.fetch({ ...account, port: 25 }, {}, async () => undefined)).rejects.toThrow(/port 993 or 143/);
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await PluginInbox.fetch({ ...account, port: 143, secure: true }, {}, async () => undefined);
    expect(reader.fetch).toHaveBeenCalledWith(expect.objectContaining({ port: 143, secure: false }), {});
  });

  it('nothing is read when the gate refuses (no network capability, non-production site)', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(PluginInbox.fetch(account, {}, async () => { throw new Error('network refused'); })).rejects.toThrow('network refused');
    expect(dns.lookup).not.toHaveBeenCalled();
    expect(reader.fetch).not.toHaveBeenCalled();
  });
});
