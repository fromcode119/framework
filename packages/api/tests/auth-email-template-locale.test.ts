import { describe, it, expect } from 'vitest';
import { AuthEmailTemplateFileService } from '@api/controllers/auth/email-templates/auth-email-template-file-service';

/**
 * Every framework email used to load exactly one file per template, so a Bulgarian install sent
 * Bulgarian pages and English email. These cover the resolution rule, including the fallback that lets
 * a language be added one template at a time.
 */
describe('AuthEmailTemplateFileService locale resolution', () => {
  it('prefers the localized file when one exists', async () => {
    const bg = await AuthEmailTemplateFileService.readTemplate('file-share.txt', 'bg');
    expect(bg).toContain('Отворете файловете си');
  });

  it('accepts a region-qualified locale', async () => {
    // Nothing here is region-specific, so bg-BG must resolve the same file as bg.
    const regional = await AuthEmailTemplateFileService.readTemplate('file-share.txt', 'bg-BG');
    expect(regional).toContain('Отворете файловете си');
  });

  it('resolves a compound .subject.txt name from the language folder', async () => {
    const subject = await AuthEmailTemplateFileService.readTemplate('file-share.subject.txt', 'bg');
    expect(subject).toContain('{{title}}');
  });

  it('reads the base folder when a language folder exists but lacks that template', async () => {
    // bg/ has only the share templates — a language is translatable one file at a time.
    const reset = await AuthEmailTemplateFileService.readTemplate('password-reset.html', 'bg');
    expect(reset).toContain('{{appName}}');
  });

  it('falls back to the base file for an untranslated language', async () => {
    // A language must be addable one template at a time; a missing translation sends readable English
    // rather than failing to send.
    const french = await AuthEmailTemplateFileService.readTemplate('file-share.txt', 'fr');
    expect(french).toContain('Open your files');
  });

  it('falls back for a template with no translations at all', async () => {
    const reset = await AuthEmailTemplateFileService.readTemplate('password-reset.txt', 'bg');
    expect(reset.length).toBeGreaterThan(0);
  });

  it('reads the base file when no locale is given', async () => {
    const base = await AuthEmailTemplateFileService.readTemplate('file-share.txt');
    expect(base).toContain('Open your files');
  });

  it('treats english as the base rather than looking for a variant', async () => {
    const english = await AuthEmailTemplateFileService.readTemplate('file-share.txt', 'en');
    expect(english).toContain('Open your files');
  });

  it('still throws for a template that does not exist', async () => {
    await expect(AuthEmailTemplateFileService.readTemplate('no-such-template.txt', 'bg')).rejects.toBeTruthy();
  });
});
