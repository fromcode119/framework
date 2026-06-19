import { Logger } from '../../logging';
import { FromcodePlugin } from '../../types';
import { PluginSignatureService } from '../../security/plugin-signature-service';
import { IntegrityService } from '../../security/integrity-service';

/**
 * PluginRegistrationSecurityService
 *
 * Integrity-checksum and signature verification performed during plugin
 * registration. Extracted from LifecycleService to keep that class under the
 * size limit; the verify() method preserves the exact prior behavior, including
 * the non-production self-heal re-stamp (which mutates plugin.manifest.checksum).
 */
export class PluginRegistrationSecurityService {
  public static async verify(plugin: FromcodePlugin, pluginPath: string | undefined, logger: Logger): Promise<void> {
    const slug = plugin.manifest.slug;

    // Integrity Check.
    // Enforced by default in production (NODE_ENV=production): a directory-hash
    // mismatch throws and the plugin is not registered, unless the operator
    // explicitly opts out with ENFORCE_PLUGIN_INTEGRITY=false. Outside production
    // a mismatch is almost always a core-version hash-recipe change or an
    // in-place dev rebuild, not tampering — so we self-heal by re-stamping the
    // checksum from the on-disk content and continue (set
    // ENFORCE_PLUGIN_INTEGRITY=true to hard-fail in dev too). Real cryptographic
    // tamper protection is signature enforcement, which a core upgrade cannot
    // false-positive.
    if (pluginPath && plugin.manifest.checksum) {
      const expectedChecksum = plugin.manifest.checksum;
      const isHealthy = await IntegrityService.verifyPluginIntegrity(pluginPath, expectedChecksum);
      if (!isHealthy) {
        if (IntegrityService.isEnforced()) {
          throw new Error(`Security Violation: Integrity check failed for plugin "${slug}"`);
        }
        const restamped = await IntegrityService.restampPlugin(pluginPath);
        plugin.manifest.checksum = restamped;
        logger.warn(
          `[INTEGRITY] Plugin "${slug}" checksum mismatch — RE-STAMPED from on-disk content (non-production self-heal). ` +
          `manifest checksum: ${expectedChecksum} → on-disk checksum: ${restamped}. ` +
          `In production this mismatch would disable the plugin. ` +
          `Set ENFORCE_PLUGIN_INTEGRITY=true to hard-fail here too, or enable signature signing for tamper protection.`
        );
      }
    }

    if (PluginSignatureService.isEnforced()) {
      const publicKey = process.env.PLUGIN_SIGNING_PUBLIC_KEY || '';
      const isValid = PluginSignatureService.verify(plugin.manifest, plugin.manifest.signature || '', publicKey);
      if (!isValid) {
        throw new Error(`Security Violation: Invalid signature for plugin "${slug}"`);
      }
    }

    if (process.env.NODE_ENV === 'production' && !plugin.manifest.checksum && !plugin.manifest.signature) {
      logger.warn(`Plugin "${slug}" has no checksum or signature — integrity cannot be verified.`);
    }
  }
}
