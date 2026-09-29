import { describe, expect, it } from 'vitest';
import { ServerPluginContext } from '@/lib/ssr/server-plugin-context';

/**
 * The server translator starts from the framework's own packs. In the browser those packs are queued when
 * their modules evaluate — ahead of every plugin bundle — so the first client render already speaks them;
 * a server translator without them painted raw `account.*` keys and failed hydration against it.
 */
describe('ServerPluginContext framework translations', () => {
  const build = (frameworkTranslations: Record<string, Record<string, unknown>>, locale = 'bg') =>
    ServerPluginContext.build({
      signature: 'no-such-generation',
      themeSlug: 'demo',
      config: {},
      serverTranslations: {},
      frameworkTranslations,
      locale,
    }) as { t: (key: string, params?: Record<string, unknown>, fallback?: string) => string };

  it('resolves framework-owned copy in the document locale', () => {
    const context = build({ en: { account: { shell: { title: 'My account' } } }, bg: { account: { shell: { title: 'Моят профил' } } } });
    expect(context.t('account.shell.title')).toBe('Моят профил');
  });

  it('falls back to the caller default when no pack has the key', () => {
    expect(build({}).t('account.shell.title', {}, 'My account')).toBe('My account');
  });
});
