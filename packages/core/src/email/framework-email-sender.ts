/**
 * The address outbound framework email is sent from, and the name shown beside it.
 *
 * This exists as a value the operator CONFIGURED, never one the framework derived. The previous
 * behaviour built `no-reply@<platform domain>` in code: no admin field produced that mailbox, the
 * operator could not change it, and it silently outranked an explicitly configured `EMAIL_FROM`.
 * It also turned the site's domain into a mail-sending domain by implication — which is how a
 * correctly-written SPF/DMARC policy for a domain that "sends no mail" came to contradict the
 * password-reset emails the platform was in fact sending from it.
 */
export class FrameworkEmailSender {
  readonly address: string;

  /** Display name, or `''` when none is configured — the address alone is then used. */
  readonly name: string;

  constructor(address: string, name = '') {
    this.address = address.trim();
    this.name = name.trim();
  }

  /** True only when there is a real address to send from. */
  get isConfigured(): boolean {
    return this.address.length > 0;
  }

  /** RFC 5322 `"Name" <address>`, or the bare address when no name is set. */
  get identity(): string {
    if (!this.name) return this.address;
    return `"${this.name.replace(/"/g, '\\"')}" <${this.address}>`;
  }
}
