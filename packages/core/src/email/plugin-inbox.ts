import { lookup } from 'node:dns/promises';
import { ImapInboxReader } from '@fromcode119/email';
import type { IInboxAccount, IInboxFetchOptions, IInboxFetchResult } from '@fromcode119/email';
import { NetworkAddressUtils } from '@core/security/network-address-utils';

/**
 * `context.email.inbox` — read a mailbox for a plugin.
 *
 * A plugin process has no network of its own, so a plugin that takes in mail (a helpdesk's support
 * address) asks the host to read it. The host connects only to a PUBLIC address on an IMAP port, for
 * the same reason `context.fetch` refuses private ones: the connection leaves from inside the platform's
 * network, where the database, redis and the api itself answer. The name is resolved once and the
 * connection made to that address, so a second lookup cannot point it somewhere else; the certificate
 * is still checked against the name.
 */
export class PluginInbox {
  static readonly PORTS = new Set([993, 143]);

  static async fetch(account: IInboxAccount, options: IInboxFetchOptions, assertNetwork: (target: string) => Promise<void>): Promise<IInboxFetchResult> {
    const host = String(account?.host ?? '').trim().toLowerCase();
    const port = Number(account?.port);
    if (!host || !PluginInbox.PORTS.has(port)) throw PluginInbox.refusal('an IMAP host and port 993 or 143 are required');
    await assertNetwork(`imap://${host}:${port}`);
    const address = await PluginInbox.publicAddress(host);
    return ImapInboxReader.fetch({ ...account, host: address, port, secure: port === 993, servername: host }, options);
  }

  /** The host's first address, when every address it resolves to is public; otherwise a refusal. */
  static async publicAddress(host: string): Promise<string> {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw PluginInbox.refusal(`${host} does not resolve`);
    }
    if (!addresses.length || !addresses.every((entry) => NetworkAddressUtils.isPublic(entry.address))) {
      throw PluginInbox.refusal(`${host} is not a public address`);
    }
    return addresses[0].address;
  }

  private static refusal(message: string): Error {
    return Object.assign(new Error(`inbox_refused: ${message}`), { code: 'EINBOXREFUSED' });
  }
}
