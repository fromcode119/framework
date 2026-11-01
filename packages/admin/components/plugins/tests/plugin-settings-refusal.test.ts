import { PluginSettingsRefusal } from '@/components/plugins/view/plugin-settings-refusal';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** A settings refusal the server names by its code reads in the console's language under its field. */
describe('PluginSettingsRefusal', () => {
  it('says each coded refusal from the dictionary, with the values it names', () => {
    const said = PluginSettingsRefusal.perField({
      errors: { apiKey: 'This field is required', retries: 'Must be at least 2', note: 'Custom words' },
      refusals: [
        { field: 'apiKey', code: 'required', message: 'This field is required' },
        { field: 'retries', code: 'belowMin', message: 'Must be at least 2', vars: { min: 2 } },
      ],
    });
    expect(said.apiKey).toBe(AdminI18n.t('plugins.list.refusal.required'));
    expect(said.apiKey).not.toBe('plugins.list.refusal.required');
    expect(said.retries).toBe(AdminI18n.t('plugins.list.refusal.belowMin', { min: 2 }));
    expect(String(said.retries)).toContain('2');
    expect(said.note).toBe('Custom words');
  });
});
