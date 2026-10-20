/**
 * The audit trail's view of a resource: an address keeps its scheme, host and path, and loses every
 * query VALUE and any userinfo. A plugin's outbound request carries its credentials in the query as
 * often as in a header — an OAuth code exchange sends the app secret there — and the audit line is
 * both printed and stored, read by people who were never meant to hold them.
 *
 * Anything that is not an absolute address (a table name, a collection path) is returned unchanged.
 */
export class AuditResourceRedactor {
  static readonly MASK = '***';

  static redact(resource: string): string {
    const raw = String(resource ?? '');
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return raw.replace(/\?.*$/s, `?${AuditResourceRedactor.MASK}`);
    }
    if (parsed.username || parsed.password) {
      parsed.username = AuditResourceRedactor.MASK;
      parsed.password = '';
    }
    const names = Array.from(new Set(parsed.searchParams.keys()));
    parsed.search = names.map((name) => `${encodeURIComponent(name)}=${AuditResourceRedactor.MASK}`).join('&');
    parsed.hash = '';
    return parsed.toString();
  }
}
