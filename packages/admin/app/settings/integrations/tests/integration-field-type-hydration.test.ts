import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';

/**
 * A provider definition arrives with `type` as a wire string, and the whole editor compares it against
 * an Enum member with `===`. Hydration used to run on the LOAD response only, so the record returned by
 * a save replaced the hydrated one with raw strings and every comparison silently answered false: the
 * password field rendered `type="text"` holding the saved-secret mask in the clear, booleans became text
 * inputs holding the string "false", and selects lost their options.
 *
 * Nothing threw and nothing logged — which is why this asserts the hydration at the boundary itself.
 */
describe('integration provider field-type hydration', () => {
  const buildResponse = () => ({
    integration: {
      key: 'shipping_provider',
      label: 'Shipping Provider',
      providers: [
        {
          key: 'econt',
          fields: [
            { name: 'demoMode', label: 'Use Demo API', type: 'boolean' },
            { name: 'username', label: 'Username', type: 'text' },
            { name: 'password', label: 'Password', type: 'password' },
            { name: 'timeoutMs', label: 'Timeout', type: 'number' },
          ],
        },
      ],
      storedProviders: [
        { id: 'p1', providerKey: 'econt', enabled: true, config: { password: '__FROMCODE_SAVED_SECRET__', username: 'a@b.c' } },
      ],
    },
  });

  it('hydrates field types on the record returned by a write, not just by a load', () => {
    const updated: any = IntegrationProviderFormHelper.extractUpdatedIntegration(buildResponse());
    const fields = updated.providers[0].fields;

    expect(fields[0].type).toBe(IntegrationFieldType.BOOLEAN);
    expect(fields[1].type).toBe(IntegrationFieldType.TEXT);
    expect(fields[2].type).toBe(IntegrationFieldType.PASSWORD);
    expect(fields[3].type).toBe(IntegrationFieldType.NUMBER);
  });

  it('keeps the saved-secret mask out of the editor rebuilt from a write response', () => {
    const updated: any = IntegrationProviderFormHelper.extractUpdatedIntegration(buildResponse());
    const editor = IntegrationProviderFormHelper.buildEditorForProvider(
      updated.storedProviders[0],
      updated.providers[0],
    );

    expect(editor.config.password).toBe('');
    expect(editor.preservedSecretFields.password).toBe(true);
  });

  it('defaults an unknown wire type to text rather than leaving the raw string', () => {
    const records: any[] = [{ key: 'k', providers: [{ key: 'p', fields: [{ name: 'f', type: 'not-a-type' }] }] }];
    IntegrationsPageUtils.hydrateFieldTypes(records);

    expect(records[0].providers[0].fields[0].type).toBe(IntegrationFieldType.TEXT);
  });
});
