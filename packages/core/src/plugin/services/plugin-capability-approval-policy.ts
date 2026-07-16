import { EnvUtils } from '../../utils/env-utils';

/**
 * Policy for whether a plugin whose manifest capabilities drifted from the approved set may be
 * auto-approved on boot (instead of held). Opt-in and trust-gated so an enabled flag can never
 * silently escalate an untrusted plugin's capabilities.
 *
 * - Enabled by `AUTO_APPROVE_PLUGIN_CAPABILITIES` (default off).
 * - Trust signal (NOT the self-declared namespace): the plugin is signature-verified, OR its slug is
 *   in the config-driven `AUTO_APPROVE_TRUSTED_SLUGS` allowlist (comma-separated). Single-tenant hosts
 *   set the allowlist to their first-party slugs; anything else stays fail-closed (held).
 */
export class PluginCapabilityApprovalPolicy {
  static isEnabled(): boolean {
    return EnvUtils.flag('AUTO_APPROVE_PLUGIN_CAPABILITIES', false);
  }

  static isTrusted(slug: string, signatureVerified: boolean): boolean {
    if (signatureVerified) return true;
    const normalized = String(slug || '').trim().toLowerCase();
    if (!normalized) return false;
    return PluginCapabilityApprovalPolicy.allowlist().includes(normalized);
  }

  static shouldAutoApprove(slug: string, signatureVerified: boolean): boolean {
    return PluginCapabilityApprovalPolicy.isEnabled() && PluginCapabilityApprovalPolicy.isTrusted(slug, signatureVerified);
  }

  private static allowlist(): string[] {
    return String(process.env.AUTO_APPROVE_TRUSTED_SLUGS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
}
