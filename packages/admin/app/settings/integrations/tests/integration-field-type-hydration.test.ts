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
          key: 'courier',
          fields: [
            { name: 'demoMode', label: 'Use Demo API', type: 'boolean' },
            { name: 'username', label: 'Username', type: 'text' },
            { name: 'password', label: 'Password', type: 'password' },
            { name: 'timeoutMs', label: 'Timeout', type: 'number' },
          ],
        },
      ],
      storedProviders: [
        { id: 'p1', providerKey: 'courier', enabled: true, config: { password: '__FROMCODE_SAVED_SECRET__', username: 'a@b.c' } },
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

/**
 * Changing the saved-secret mask needs no migration and no coordinated deploy.
 *
 * The concern would be a form rendered under the OLD mask posting it back to a server that has
 * already moved to the NEW one — the server would not recognise it and would store the literal as
 * if it were the secret. It cannot happen: the admin blanks every secret field on the way in and
 * sends `''`, which the server reads as "keep what is stored". The mask travels server -> admin
 * only, and never makes the return trip.
 */
describe('saved-secret mask never makes the return trip', () => {
  const provider: any = {
    key: 'courier',
    fields: [
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  };

  it('blanks the secret on the way in and posts blank, whatever mask the server used', () => {
    const hydrated: any = IntegrationsPageUtils.hydrateFieldTypes([{ providers: [provider] }])[0].providers[0];

    for (const serverMask of ['__ATLANTIS_SAVED_SECRET__', '__FROMCODE_SAVED_SECRET__', '__ANY_FUTURE_MASK__']) {
      const editor = IntegrationProviderFormHelper.buildEditorForProvider(
        { id: 'p1', providerKey: 'courier', enabled: true, config: { username: 'a@b.c', password: serverMask } } as any,
        hydrated,
      );
      const payload = IntegrationProviderFormHelper.buildSavePayload(hydrated, editor);

      expect(editor.config.password).toBe('');
      expect(payload.config.password).toBe('');
      expect(JSON.stringify(payload)).not.toContain('SAVED_SECRET');
    }
  });
});
