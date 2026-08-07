import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import { IntegrationConfigSanitizer } from '@core/integrations/integration-config-sanitizer';
import { SecretService } from '@core/security/secret-service';

const MASK = SecretService.getSavedSecretMask();

const smtpProvider: any = {
  key: 'smtp',
  label: 'SMTP',
  create: () => ({}),
  fields: [
    { name: 'host', label: 'Host', type: IntegrationConfigFieldType.TEXT },
    { name: 'port', label: 'Port', type: IntegrationConfigFieldType.NUMBER },
    { name: 'secure', label: 'Secure', type: IntegrationConfigFieldType.BOOLEAN },
    { name: 'user', label: 'User', type: IntegrationConfigFieldType.TEXT },
    { name: 'pass', label: 'Password', type: IntegrationConfigFieldType.PASSWORD },
  ],
};

describe('IntegrationConfigSanitizer.sanitizeForAdmin', () => {
  it('masks EVERY value when the provider definition is unknown (plugin disabled / not registered)', () => {
    const sanitized = IntegrationConfigSanitizer.sanitizeForAdmin(null, {
      host: 'smtp.example.com',
      user: 'postmaster@example.com',
      pass: 'super-secret',
      port: 587,
    });

    expect(sanitized).toEqual({ host: MASK, user: MASK, pass: MASK, port: MASK });
    expect(JSON.stringify(sanitized)).not.toContain('smtp.example.com');
    expect(JSON.stringify(sanitized)).not.toContain('super-secret');
  });

  it('masks nothing into existence: an unknown provider with empty values stays empty', () => {
    expect(IntegrationConfigSanitizer.sanitizeForAdmin(undefined, { host: '', pass: '   ' }))
      .toEqual({ host: '', pass: '' });
  });

  it('masks declared password fields and passes the rest through for a known provider', () => {
    const sanitized = IntegrationConfigSanitizer.sanitizeForAdmin(smtpProvider, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'postmaster@example.com',
      pass: 'super-secret',
    });

    expect(sanitized).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'postmaster@example.com',
      pass: MASK,
    });
  });

  it('drops undeclared keys — the nested auth blob that carried the decrypted SMTP password', () => {
    const sanitized = IntegrationConfigSanitizer.sanitizeForAdmin(smtpProvider, {
      host: 'smtp.example.com',
      pass: 'super-secret',
      auth: { user: 'postmaster@example.com', pass: 'super-secret' },
    });

    expect(sanitized).not.toHaveProperty('auth');
    expect(JSON.stringify(sanitized)).not.toContain('super-secret');
  });

  it('treats an unrecognised field type as secret rather than assuming plain text', () => {
    const provider: any = {
      key: 'custom',
      label: 'Custom',
      create: () => ({}),
      fields: [{ name: 'token', label: 'Token', type: 'totally-unknown-type' }],
    };

    expect(IntegrationConfigSanitizer.sanitizeForAdmin(provider, { token: 'live-token' }))
      .toEqual({ token: MASK });
  });

  it('omits declared fields the stored config does not have, instead of inventing empty ones', () => {
    expect(IntegrationConfigSanitizer.sanitizeForAdmin(smtpProvider, { host: 'smtp.example.com' }))
      .toEqual({ host: 'smtp.example.com' });
  });
});

describe('IntegrationConfigSanitizer.secretFieldNames', () => {
  it('lists password-typed fields', () => {
    expect(IntegrationConfigSanitizer.secretFieldNames(smtpProvider)).toEqual(['pass']);
  });

  it('includes unrecognised types so the read mask and the write round-trip agree', () => {
    const provider: any = {
      key: 'custom',
      label: 'Custom',
      create: () => ({}),
      fields: [
        { name: 'plain', label: 'Plain', type: IntegrationConfigFieldType.TEXT },
        { name: 'token', label: 'Token', type: 'totally-unknown-type' },
      ],
    };

    expect(IntegrationConfigSanitizer.secretFieldNames(provider)).toEqual(['token']);
  });

  it('is empty for an unknown provider — there is no field list to read', () => {
    expect(IntegrationConfigSanitizer.secretFieldNames(null)).toEqual([]);
  });
});
