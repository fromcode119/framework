import { ImapFlow } from 'imapflow';
import type { IInboxAccount } from '@email/interfaces/inbox-account.interface';
import type { IInboxFetchOptions } from '@email/interfaces/inbox-fetch-options.interface';
import type { IInboxFetchResult } from '@email/interfaces/inbox-fetch-result.interface';
import type { IInboundMessage } from '@email/interfaces/inbound-message.interface';
import { InboundMessageParser } from '@email/inbox/inbound-message-parser';

/**
 * Reads new mail from an IMAP folder: everything after a UID the caller remembers, oldest first. It
 * never deletes or moves anything.
 *
 * Where it may connect is not decided here — the caller (the plugin context) checks the host first.
 */
export class ImapInboxReader {
  static readonly DEFAULT_LIMIT = 25;
  static readonly MAX_LIMIT = 100;
  /** Larger messages are skipped (attachments): an application reads the conversation, not the files. */
  static readonly MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

  static async fetch(account: IInboxAccount, options: IInboxFetchOptions = {}): Promise<IInboxFetchResult> {
    const sinceUid = Math.max(0, Math.floor(Number(options.sinceUid) || 0));
    const limit = Math.min(ImapInboxReader.MAX_LIMIT, Math.max(1, Math.floor(Number(options.limit) || ImapInboxReader.DEFAULT_LIMIT)));
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.secure,
      servername: account.servername || undefined,
      auth: { user: account.user, pass: account.password },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });
    await client.connect();
    try {
      const lock = await client.getMailboxLock(account.mailbox || 'INBOX');
      try {
        const box = client.mailbox;
        const uidValidity = box ? String(box.uidValidity) : '';
        const found: Array<{ uid: number; size: number }> = [];
        // `n:*` always includes the newest message, even when it is older than n — filter by UID.
        for await (const message of client.fetch(`${sinceUid + 1}:*`, { uid: true, size: true }, { uid: true })) {
          if (message.uid > sinceUid) found.push({ uid: message.uid, size: Number(message.size) || 0 });
        }
        found.sort((a, b) => a.uid - b.uid);
        const batch = found.slice(0, limit);
        const messages: IInboundMessage[] = [];
        for (const entry of batch) {
          if (entry.size > ImapInboxReader.MAX_MESSAGE_BYTES) continue;
          const fetched = await client.fetchOne(String(entry.uid), { source: true }, { uid: true });
          if (fetched && fetched.source) messages.push(await InboundMessageParser.parse(entry.uid, fetched.source));
        }
        const lastUid = batch.length ? batch[batch.length - 1].uid : sinceUid;
        return { uidValidity, lastUid, messages };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}
