import { describe, expect, it } from 'vitest';
import { EmailCategoryAvailability } from '@core/email/email-category-availability';
import { EmailCategoryRegistry } from '@core/email/email-category-registry';

/**
 * A site that has a feature switched off sends none of its mail, so its customers must not be asked
 * whether they want it: a stream naming an `enabledBy` setting is listed only while that setting is on.
 */
describe('which email streams a site offers', () => {
  const registry = new EmailCategoryRegistry();
  registry.register({ key: 'newsletter', labelKey: 'n', descriptionKey: 'n', pluginSlug: 'news' });
  registry.register({ key: 'saved-items', labelKey: 's', descriptionKey: 's', pluginSlug: 'shop', enabledBy: 'savedEnabled' });
  registry.register({ key: 'reminders', labelKey: 'r', descriptionKey: 'r', pluginSlug: 'shop', enabledBy: 'remindersEnabled' });
  const schema = { fields: [{ name: 'savedEnabled', defaultValue: false }, { name: 'remindersEnabled', defaultValue: true }] };
  const db = (settings: Record<string, unknown> | null) => ({ findOne: async () => (settings ? { settings: { settings } } : null) });

  it('lists a stream without a switch always, and one with a switch by its schema default when never set', async () => {
    const keys = (await EmailCategoryAvailability.offered(registry.list(), () => schema, db(null))).map((c) => c.key);
    expect(keys).toEqual(['newsletter', 'reminders']);
  });

  it('follows the stored value over the default', async () => {
    const keys = (await EmailCategoryAvailability.offered(registry.list(), () => schema, db({ savedEnabled: true, remindersEnabled: false }))).map((c) => c.key);
    expect(keys).toEqual(['newsletter', 'saved-items']);
  });

  it('keeps the setting key through registration', () => {
    expect(registry.get('saved-items')?.enabledBy).toBe('savedEnabled');
    expect(registry.get('newsletter')).not.toHaveProperty('enabledBy');
  });
});
