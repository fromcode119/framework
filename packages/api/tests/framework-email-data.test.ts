import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordResetEmailTemplate } from '@api/controllers/auth/email-templates/password-reset-email-template';
import { SecurityNotificationEmailTemplate } from '@api/controllers/auth/email-templates/security-notification-email-template';
import { AuthEmailThemeOverride } from '@api/controllers/auth/email-templates/auth-email-theme-override';
import { SecurityNotificationEvent } from '@api/controllers/auth/enums/security-notification-event.enum';

/**
 * The framework's own emails get their data whole — the person, the site's name and theme variables —
 * and the template for the reader's language (the active theme's copy first) decides the words.
 */
const common = (locale: string, firstName = '') => ({
  appName: 'Shop & Co',
  user: { firstName, email: 'reader@example.com' },
  theme: { contactEmail: 'hello@shop.example' },
  locale,
});

describe('framework emails', () => {
  afterEach(() => AuthEmailThemeOverride.configure(null));

  it("a password reset in the site's language, greeting by name only when there is one", async () => {
    const named = await PasswordResetEmailTemplate.build({ ...common('bg', "O'Brien"), resetUrl: 'https://shop.example/reset?t=a=b&x=1' });
    expect(named.subject).toBe('Shop & Co: Смяна на паролата');
    expect(named.text).toContain("Здравейте, O'Brien,");
    expect(named.text).toContain('https://shop.example/reset?t=a=b&x=1');
    expect(named.html).toContain('Здравейте, O&#x27;Brien,');
    expect(named.html).toContain('Shop &amp; Co');
    const anonymous = await PasswordResetEmailTemplate.build({ ...common('en'), resetUrl: 'https://shop.example/r' });
    expect(anonymous.text.startsWith('Hi,')).toBe(true);
  });

  it('a security notice names the event; the template writes the sentence and the lines', async () => {
    const email = await SecurityNotificationEmailTemplate.build({
      ...common('bg'),
      event: SecurityNotificationEvent.EMAIL_CHANGED,
      facts: { previousEmail: 'old@example.com' },
    });
    expect(email.subject).toBe('Shop & Co: Имейлът е сменен успешно');
    expect(email.text).toContain('Имейлът на профила ви е обновен.');
    expect(email.text).toContain('Предишен имейл: old@example.com');
    expect(email.text).not.toContain('IP адрес');
    // Written as the reader's language writes a date, never the raw ISO stamp.
    expect(email.text).toMatch(/Час: \d{1,2} [а-я]+ \d{4}/);
    expect(email.text).not.toMatch(/Час: \d{4}-\d{2}-\d{2}T/);
    const login = await SecurityNotificationEmailTemplate.build({ ...common('en'), event: SecurityNotificationEvent.NEW_LOGIN, facts: { ipAddress: '10.0.0.1' } });
    expect(login.subject).toBe('Shop & Co: New login detected');
    expect(login.html).toContain('<li>IP address: 10.0.0.1</li>');
  });

  it("the active theme's copy wins, in the reader's language, and receives the theme variables", async () => {
    const themeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
    const overrides = path.join(themeDir, AuthEmailThemeOverride.DIRECTORY, 'bg');
    fs.mkdirSync(overrides, { recursive: true });
    fs.writeFileSync(path.join(overrides, 'password-reset.html'), '<p>{{user.firstName}} · {{theme.contactEmail}}</p>');
    AuthEmailThemeOverride.configure({
      getActiveThemeManifest: () => ({ slug: 'any' }),
      getThemeDirectory: () => themeDir,
      getActiveThemeVariables: async () => ({}),
    });
    const bg = await PasswordResetEmailTemplate.build({ ...common('bg', 'Мария'), resetUrl: 'https://shop.example/r' });
    expect(bg.html).toBe('<p>Мария · hello@shop.example</p>');
    // Only what the theme ships is replaced: its subject still comes from the framework.
    expect(bg.subject).toBe('Shop & Co: Смяна на паролата');
    // An English reader gets the framework's English, not the theme's Bulgarian.
    const en = await PasswordResetEmailTemplate.build({ ...common('en', 'Maria'), resetUrl: 'https://shop.example/r' });
    expect(en.html).toContain('Reset password');
  });
});
