import { AuditResourceRedactor } from '@core/security/audit-resource-redactor';

describe('AuditResourceRedactor.redact', () => {
  it('masks every query value of an OAuth code exchange and keeps the names', () => {
    const out = AuditResourceRedactor.redact('https://graph.facebook.com/v23.0/oauth/access_token?client_id=1&client_secret=s3cr3t&code=abc&redirect_uri=https%3A%2F%2Fapi.example.test');
    expect(out).toBe('https://graph.facebook.com/v23.0/oauth/access_token?client_id=***&client_secret=***&code=***&redirect_uri=***');
    expect(out).not.toContain('s3cr3t');
  });

  it('masks userinfo and drops the fragment', () => {
    const out = AuditResourceRedactor.redact('imaps://mail-user:hunter2@mail.example.test/INBOX#token=x');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('token=x');
    expect(out).toContain('mail.example.test/INBOX');
  });

  it('leaves an address with no query, and a non-address resource, unchanged', () => {
    expect(AuditResourceRedactor.redact('https://api.example.test/v1/items')).toBe('https://api.example.test/v1/items');
    expect(AuditResourceRedactor.redact('orders/12')).toBe('orders/12');
    expect(AuditResourceRedactor.redact('fcp_shop_orders?x=1')).toBe('fcp_shop_orders?x=1');
  });

  it('still hides the query of an address it cannot parse', () => {
    expect(AuditResourceRedactor.redact('https://exa mple.test/a?access_token=t0k')).toBe('https://exa mple.test/a?***');
  });
});
