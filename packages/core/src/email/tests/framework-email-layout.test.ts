import { describe, it, expect } from 'vitest';
import { FrameworkEmailLayout } from '@core/email/framework-email-layout';

const sourceWith = (meta: Record<string, string>) => ({
  db: { findOne: async (_table: string, where: Record<string, unknown>) => (meta[String(where.key)] ? { value: meta[String(where.key)] } : null) },
});

describe('FrameworkEmailLayout', () => {
  it('frames a text-only message under the platform name with the subject as heading and a recipients footer', async () => {
    const html = await FrameworkEmailLayout.wrap(sourceWith({ platform_name: 'Fromcode' }), {
      subject: '[Atlantis] "marketplace" is waiting for your approval',
      text: 'First paragraph.\n\nSecond <b>paragraph</b>.',
    });
    expect(html).toContain('>Fromcode</span>');
    expect(html).toContain('<h1');
    expect(html).toContain('is waiting for your approval');
    expect(html).toContain('<p style="margin:0 0 16px">First paragraph.</p>');
    expect(html).toContain('&lt;b&gt;paragraph&lt;/b&gt;');
    expect(html).toContain('Settings &rarr; General &rarr; Notification Email');
  });

  it('keeps a template body as html and invents no name when none is set', async () => {
    const html = await FrameworkEmailLayout.wrap(sourceWith({}), { subject: 'S', html: '<ul><li>kept</li></ul>', text: 'x' });
    expect(html).toContain('<ul><li>kept</li></ul>');
    expect(html).not.toContain('Sent by');
  });
});

describe('FrameworkEmailLayout theme override', () => {
  it('uses the active theme\'s own email-layout.html when it ships one', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
    const file = path.join(dir, 'src', 'overrides', 'framework', 'emails', 'email-layout.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '<section>{{subject}}|{{{bodyHtml}}}</section>');
    const themes = { getActiveThemeManifest: () => ({ slug: 't' }), getThemeDirectory: () => dir };
    const html = await FrameworkEmailLayout.wrap({ ...sourceWith({}), themeManager: themes }, { subject: 'S', html: '<i>b</i>' });
    expect(html).toBe('<section>S|<i>b</i></section>');
    const none = await FrameworkEmailLayout.wrap({ ...sourceWith({}), themeManager: { ...themes, getThemeDirectory: () => path.join(dir, 'missing') } }, { subject: 'S', html: '<i>b</i>' });
    expect(none).toContain('Notification Email');
  });
});
