import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { SecretService } from '@core/security/secret-service';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';

/**
 * Rows an archive carries that the destination must NOT take.
 *
 * Two kinds, and both are about the destination rather than the archive. A platform-level setting
 * belongs to the deployment that exported it — URLs, rate limits, retention — and the destination has
 * its own. A setting belonging to a plugin the destination does not have would arrive as configuration
 * for something that cannot read it.
 *
 * Shared, because both importers need exactly the same answer: a site on a platform and a standalone
 * deployment differ in who owns the rows, not in which rows are theirs to take.
 */
export class TenantImportRowFilter {
  /** `true` when the row should be skipped. */
  static forTable(
    table: TenantTableDescriptor,
    installedPlugins: Set<string>,
    transitPassphrase?: string,
  ): (row: Record<string, unknown>) => boolean {
    if (table.name === SystemConstants.TABLE.META) {
      const platform = new Set(TenantBespokePolicies.platformKeys());
      return (row) => platform.has(String(row.key ?? ''))
        || TenantImportRowFilter.isUnreadableSigningRoot(row, transitPassphrase);
    }
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) {
      return (row) => !installedPlugins.has(String(row.plugin_slug ?? ''));
    }
    return () => false;
  }

  /**
   * A site's link-signing root that will not open on this deployment.
   *
   * The root is sealed under the EXPORTING deployment's key. Resealed for transit it arrives readable
   * and is kept, so every link already sent keeps verifying. Without that, it arrives sealed under a
   * key this deployment does not have, and every signed link of the site — unsubscribe, invoice,
   * review — then throws, because the root is present but cannot be opened. Dropped, the site mints a
   * fresh root on first use; the links sent from the old deployment could never have verified here
   * either way.
   */
  private static isUnreadableSigningRoot(row: Record<string, unknown>, transitPassphrase?: string): boolean {
    if (String(row.key ?? '') !== SigningSecretService.ROOT_META_KEY) return false;
    const value = String(row.value ?? '');
    if (!SecretService.isEncryptedValue(value)) return false;
    if (transitPassphrase) {
      try {
        SecretService.decryptWith(value, transitPassphrase);
        return false;
      } catch {
        // Not sealed for transit under this passphrase; it may still open under this deployment's key.
      }
    }
    return !SecretTransitResealer.readableHere(value);
  }
}
