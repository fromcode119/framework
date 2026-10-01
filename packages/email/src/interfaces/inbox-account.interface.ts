/** An IMAP mailbox to read: where it is and how to sign in. */
export interface IInboxAccount {
  host: string;
  port: number;
  /** TLS from the first byte (993). False means STARTTLS on 143. */
  secure: boolean;
  user: string;
  password: string;
  /** The certificate name to verify when `host` is an address the caller already resolved. */
  servername?: string;
  /** Folder to read; INBOX when empty. */
  mailbox?: string;
}
