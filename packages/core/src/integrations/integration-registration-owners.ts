/**
 * Who registered each integration type and provider: a plugin slug, or the framework (no owner given).
 *
 * Registration used to OVERWRITE whatever held the key. A plugin registering a provider under the
 * active email provider's key was handed its decrypted credentials on the next instantiation, and every
 * password-reset mail went through its code from then on; re-registering a core type replaced it
 * wholesale. A plugin may now add types and providers, and re-register its own (a hot reload), but
 * never replace one the framework or another plugin registered. The framework itself is never refused.
 *
 * A claim only counts while its key is still registered, so unregistering frees the key without this
 * class having to be told.
 */
export class IntegrationRegistrationOwners {
  static readonly FRAMEWORK = '';

  private readonly owners = new Map<string, string>();

  claimType(typeKey: string, owner: string, registered: boolean): void {
    this.claim(typeKey, `integration type "${typeKey}"`, owner, registered);
  }

  claimProvider(typeKey: string, providerKey: string, owner: string, registered: boolean): void {
    this.claim(`${typeKey}/${providerKey}`, `provider "${providerKey}" of integration type "${typeKey}"`, owner, registered);
  }

  private claim(slot: string, label: string, owner: string, registered: boolean): void {
    const claimant = String(owner ?? '').trim();
    // Registered with no recorded owner means the framework put it there (it registers directly).
    const holder = registered ? (this.owners.get(slot) ?? IntegrationRegistrationOwners.FRAMEWORK) : undefined;
    if (holder !== undefined && claimant !== IntegrationRegistrationOwners.FRAMEWORK && holder !== claimant) {
      const by = holder === IntegrationRegistrationOwners.FRAMEWORK ? 'the framework' : `plugin "${holder}"`;
      throw new Error(`Plugin "${claimant}" may not replace ${label}: it is registered by ${by}.`);
    }
    this.owners.set(slot, claimant);
  }
}
