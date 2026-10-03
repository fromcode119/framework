import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { PluginConsentSet } from '@core/plugin/consent/plugin-consent-set';

/**
 * Whether a loaded plugin's approval covers everything its manifest asks for — asked on every
 * capability check, so it is remembered per manifest and approved list. Both are replaced, never
 * mutated, when they change (a hot update swaps the manifest, an approval swaps the list), so a stale
 * answer cannot outlive the change.
 */
export class PluginApprovalCoverage {
  private static readonly answers = new WeakMap<object, WeakMap<object, boolean>>();
  private static readonly NOTHING_APPROVED: readonly string[] = Object.freeze([]);

  static covers(plugin: { manifest: IPluginManifest; approvedCapabilities?: string[] }): boolean {
    const approved = plugin.approvedCapabilities || PluginApprovalCoverage.NOTHING_APPROVED;
    let byApproval = PluginApprovalCoverage.answers.get(plugin.manifest);
    if (!byApproval) {
      byApproval = new WeakMap();
      PluginApprovalCoverage.answers.set(plugin.manifest, byApproval);
    }
    let answer = byApproval.get(approved);
    if (answer === undefined) {
      answer = PluginConsentSet.covers(plugin.manifest, approved);
      byApproval.set(approved, answer);
    }
    return answer;
  }
}
