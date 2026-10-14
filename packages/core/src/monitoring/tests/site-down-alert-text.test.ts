import { describe, expect, it } from 'vitest';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';

/** The alert says the site was asked more than once, so a reader can tell it from a single stalled probe. */
describe('the site-down alert', () => {
  const render = (values: Record<string, unknown>) => PluginEmailTemplateFileService.renderEmail('monitoring-incident', {
    subject: 'shop', openedAt: '2026-10-14T05:00:00Z', resolvedAt: '', isResolved: false, isSiteDown: true, ...values,
  });

  it('says how many attempts in a row failed', () => {
    const message = render({ url: 'https://shop.example/', error: 'UND_ERR_CONNECT_TIMEOUT', attempts: 2 });

    expect(message.text).toContain('did not answer (UND_ERR_CONNECT_TIMEOUT), 2 attempts in a row.');
    expect(message.html).toContain('2 attempts in a row');
  });

  it('keeps the old wording when the incident carries no attempt count', () => {
    const message = render({ url: 'https://shop.example/', status: 503 });

    expect(message.text).toContain('answered with a server error (503).');
    expect(message.text).not.toContain('attempts');
  });
});
