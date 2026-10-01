import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';

/**
 * A provider field may declare `defaultValue`. The editor ignored it, so a required field with a declared
 * default (the monitoring providers' name prefix) opened blank and refused to save until it was retyped.
 */
describe('IntegrationsPageUtils.defaultConfigForFields', () => {
  it('starts a new provider with every declared default, and nothing for fields without one', () => {
    const config = IntegrationsPageUtils.defaultConfigForFields([
      { name: 'apiKey' },
      { name: 'namePrefix', defaultValue: 'Platform: ' },
      { name: 'verbose', defaultValue: false },
    ]);

    expect(config).toEqual({ namePrefix: 'Platform: ', verbose: false });
  });

  it('answers an empty config when the provider is unknown', () => {
    expect(IntegrationsPageUtils.defaultConfigForFields(undefined)).toEqual({});
  });
});
