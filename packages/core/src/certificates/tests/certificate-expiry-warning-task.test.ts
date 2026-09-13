import { describe, expect, it, vi } from 'vitest';
import { CertificateExpiryWarningTask } from '@core/certificates/certificate-expiry-warning-task';
import { CertificateRecord } from '@core/certificates/certificate-record';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';

/**
 * Who gets told, and how often.
 *
 * The repeat rule is the whole point. A daily sweep that warned on every run would send thirty
 * emails in a month and train the operator to filter them — so the one warning that matters, the day
 * before a certificate dies, would land in a folder nobody reads.
 */
describe('CertificateExpiryWarningTask', () => {
  const day = 86_400_000;

  const record = (host: string, daysOut: number, lastWarned: number | null = null): CertificateRecord =>
    CertificateRecord.from({
      host, source: 'uploaded', state: 'serving', tenant_id: 'acme',
      certificate_pem: 'x', private_key_enc: 'enc:v1:x', issuer: 'CN=Test',
      not_after: new Date(Date.now() + daysOut * day).toISOString(),
      last_warned_days: lastWarned,
    });

  /** Enough of a manager for notifyAdmins to complete without sending anything. */
  const manager = () => ({
    db: { findOne: async () => null },
    writeLog: async () => undefined,
    integrations: {},
  });

  const runWith = async (records: CertificateRecord[]) => {
    const marked: Array<{ host: string; days: number }> = [];
    const store = {
      list: async () => records,
      markWarned: async (host: string, days: number) => { marked.push({ host, days }); },
    };
    await new CertificateExpiryWarningTask(store as any, manager()).run();
    return marked;
  };

  it('says nothing about a certificate with months left', async () => {
    expect(await runWith([record('quiet.test', 90)])).toEqual([]);
  });

  it('warns at each threshold as it is crossed', async () => {
    expect(await runWith([record('a.test', 30)])).toEqual([{ host: 'a.test', days: 30 }]);
    expect(await runWith([record('a.test', 20)])).toEqual([{ host: 'a.test', days: 30 }]);
    expect(await runWith([record('a.test', 10)])).toEqual([{ host: 'a.test', days: 14 }]);
    expect(await runWith([record('a.test', 1)])).toEqual([{ host: 'a.test', days: 1 }]);
  });

  it('does NOT warn again at a threshold already sent', async () => {
    expect(await runWith([record('a.test', 20, 30)])).toEqual([]);
    expect(await runWith([record('a.test', 5, 7)])).toEqual([]);
  });

  it('warns once more when it actually expires, then goes quiet', async () => {
    expect(await runWith([record('a.test', -1, 1)])).toEqual([{ host: 'a.test', days: 0 }]);
    expect(await runWith([record('a.test', -5, 0)])).toEqual([]);
  });

  it('keeps going when one warning cannot be sent — the next row may be the urgent one', async () => {
    const marked: Array<string> = [];
    const store = {
      list: async () => [record('breaks.test', 1), record('fine.test', 1)],
      markWarned: async (host: string) => { marked.push(host); },
    };
    const broken = { ...manager(), db: { findOne: () => { throw new Error('db down'); } } };
    const spy = vi.spyOn(PluginEmailTemplateFileService, 'renderEmail');

    await new CertificateExpiryWarningTask(store as any, broken as any).run();

    expect(marked).toEqual(['breaks.test', 'fine.test']);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('renders real copy from the template files, and names the uploaded case explicitly', () => {
    const soon = PluginEmailTemplateFileService.renderEmail('certificate-expiry', {
      host: 'shop.test', issuer: 'CN=Test', notAfter: '2026-10-01',
      daysRemaining: 7, isSingleDay: false, isExpired: false, isUploaded: true, siteSlug: 'shop',
    });
    expect(soon.subject).toContain('shop.test');
    expect(soon.subject).toContain('7 days');
    expect(soon.text).toContain('nothing renews it automatically');
    expect(soon.html).toContain('shop.test');

    const gone = PluginEmailTemplateFileService.renderEmail('certificate-expiry', {
      host: 'shop.test', issuer: 'CN=Test', notAfter: '2026-01-01',
      daysRemaining: 0, isSingleDay: false, isExpired: true, isUploaded: true, siteSlug: 'shop',
    });
    expect(gone.subject).toContain('EXPIRED');
    expect(gone.text).toContain('browser security warning');
  });

  it('says "1 day", not "1 days"', () => {
    const one = PluginEmailTemplateFileService.renderEmail('certificate-expiry', {
      host: 'shop.test', issuer: 'CN=Test', notAfter: '2026-10-01',
      daysRemaining: 1, isSingleDay: true, isExpired: false, isUploaded: true, siteSlug: '',
    });
    expect(one.subject).toContain('1 day');
    expect(one.subject).not.toContain('1 days');
  });
});
