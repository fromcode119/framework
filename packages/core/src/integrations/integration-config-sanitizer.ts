import { CoercionUtils } from '@core/coercion-utils';
import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import { SecretService } from '@core/security/secret-service';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';

/**
 * Decides what an integration provider config may look like once it leaves the server.
 *
 * Every rule here FAILS CLOSED — when the server knows less, it reveals less:
 *
 * - **Unknown provider definition** (its plugin is disabled, failed to load, or the stored profile
 *   names a provider nobody registered): the field list that says which values are secret is exactly
 *   what is missing, so every value is masked. Returning the raw config in that case leaked an
 *   integration's credentials precisely when the system knew least about it.
 * - **Undeclared keys are dropped.** Only keys the provider declares as fields can be seen and changed
 *   in admin, so a key outside that list is not operator config — it is derived runtime state, and
 *   that is where decrypted secrets hide (the email provider resolves `auth: { user, pass }` from the
 *   decrypted SMTP password; `pass` was masked, `auth.pass` was shipped in plaintext).
 * - **Unrecognised field type is treated as secret.** A type the framework does not know is not a
 *   known-safe control, so it is masked rather than assumed to be plain text.
 *
 * The same secret set drives the write path ({@link IntegrationConfigSanitizer.secretFieldNames}), so a
 * masked value posted back by the admin form is recognised and the stored secret is kept.
 */
export class IntegrationConfigSanitizer {
  /**
   * The admin-facing view of a provider config: declared fields only, secrets masked, everything
   * masked when `provider` is unknown.
   */
  static sanitizeForAdmin(
    provider: IIntegrationProviderDefinition<any> | null | undefined,
    config: Record<string, any>,
  ): Record<string, any> {
    const source = config || {};
    if (!provider) {
      return IntegrationConfigSanitizer.maskEveryValue(source);
    }

    const sanitizedConfig: Record<string, any> = {};
    for (const field of provider.fields || []) {
      const fieldName = CoercionUtils.toString(field?.name);
      if (!fieldName || !Object.prototype.hasOwnProperty.call(source, fieldName)) continue;
      sanitizedConfig[fieldName] = IntegrationConfigSanitizer.isSecretField(field)
        ? SecretService.maskIfPresent(source[fieldName])
        : source[fieldName];
    }
    return sanitizedConfig;
  }

  /** Names of the fields whose values are stored encrypted and never leave the server in the clear. */
  static secretFieldNames(provider: IIntegrationProviderDefinition<any> | null | undefined): string[] {
    return (provider?.fields || [])
      .filter((field) => IntegrationConfigSanitizer.isSecretField(field))
      .map((field) => CoercionUtils.toString(field?.name))
      .filter(Boolean);
  }

  /** No field list to consult — reveal nothing, while still stating which keys hold a value. */
  private static maskEveryValue(config: Record<string, any>): Record<string, any> {
    const maskedConfig: Record<string, any> = {};
    for (const key of Object.keys(config)) {
      maskedConfig[key] = SecretService.maskIfPresent(config[key]);
    }
    return maskedConfig;
  }

  private static isSecretField(field: IIntegrationConfigField): boolean {
    const declaredType = CoercionUtils.toString(field?.type).toLowerCase();
    if (!IntegrationConfigFieldType.has(declaredType)) return true;
    return declaredType === String(IntegrationConfigFieldType.PASSWORD);
  }
}
