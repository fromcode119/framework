import type { IInboxAccount, IInboxFetchOptions, IInboxFetchResult } from '@fromcode119/email';

/** `context.email.inbox` — new mail from an IMAP mailbox, read by the host (public hosts, IMAP ports). */
export interface IPluginContextEmailInbox {
  fetch(account: IInboxAccount, options?: IInboxFetchOptions): Promise<IInboxFetchResult>;
}
