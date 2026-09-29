import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { DefaultPageContentValues } from '@core/services/default-page-contract/default-page-content-values';

/**
 * Default page text that names who runs a site is filled in for the site being seeded — never written
 * into the plugin, where every site would publish the same company.
 */
describe('DefaultPageContentValues', () => {
  const content = [{ type: 'content', data: { text: 'Organiser: {{organiserName}} ({{ organiserUic }}), site {{siteName}}.', level: 2, tags: ['{{siteName}}'] } }];

  const manager = (options: { platformName?: string; api?: Record<string, unknown> | null; state?: PluginState } = {}) => ({
    db: { find: async () => (options.platformName === undefined ? [] : [{ key: SystemConstants.META_KEY.PLATFORM_NAME, value: options.platformName }]) },
    plugins: new Map(options.api === null ? [] : [['membership', { manifest: { slug: 'membership' }, state: options.state ?? PluginState.ACTIVE, publicAPI: options.api ?? {} }]]),
  }) as any;

  const payload = (contentValues?: string, defaultContent: any[] = content) => ({
    canonicalKey: 'org.example:membership:terms', namespace: 'org.example', pluginSlug: 'membership', key: 'terms',
    slug: 'terms', customPermalink: '/terms', aliases: [], recipe: 'membership.terms', defaultContent, contentValues,
  });

  it("fills the site's own values and the owning plugin's, leaving structure and non-text untouched", async () => {
    let asked: unknown;
    const api = { partnerPageValues: async (input: unknown) => { asked = input; return { organiserName: 'Acme OOD', organiserUic: 123456789 }; } };
    const filled = await new DefaultPageContentValues(manager({ platformName: 'Acme Stars', api })).fill(payload('partnerPageValues'));
    expect(filled).toEqual([{ type: 'content', data: { text: 'Organiser: Acme OOD (123456789), site Acme Stars.', level: 2, tags: ['Acme Stars'] } }]);
    expect(asked).toEqual({ contractKey: 'terms' });
  });

  it('leaves a placeholder with no value empty rather than inventing one', async () => {
    const filled = await new DefaultPageContentValues(manager({ platformName: '' })).fill(payload());
    expect((filled[0] as any).data.text).toBe('Organiser:  (), site .');
  });

  it('does not ask a plugin that is not active, or a method it does not have', async () => {
    const api = { partnerPageValues: async () => ({ organiserName: 'Should not appear' }) };
    const inactive = await new DefaultPageContentValues(manager({ api, state: PluginState.INACTIVE })).fill(payload('partnerPageValues'));
    expect((inactive[0] as any).data.text).not.toContain('Should not appear');
    const missing = await new DefaultPageContentValues(manager({ api })).fill(payload('noSuchMethod'));
    expect((missing[0] as any).data.text).toBe('Organiser:  (), site .');
  });

  it('returns content without placeholders as it is', async () => {
    const plain = [{ type: 'content', data: { text: 'Nothing to fill.' } }];
    expect(await new DefaultPageContentValues(manager({ platformName: 'X' })).fill(payload(undefined, plain))).toBe(plain);
  });
});
