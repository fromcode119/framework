import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { IPluginConsentEntry } from '@core/plugin/consent/interfaces/plugin-consent-entry.interface';
import type { IPluginConsentSummary } from '@core/plugin/consent/interfaces/plugin-consent-summary.interface';
import { PluginCapabilityRisk } from '@core/plugin/consent/plugin-capability-risk';
import { PluginConsentEntryKind } from '@core/plugin/consent/enums/plugin-consent-entry-kind.enum';
import { PluginConsentRisk } from '@core/plugin/consent/enums/plugin-consent-risk.enum';
import { PluginConsentSet } from '@core/plugin/consent/plugin-consent-set';
import { PluginNetworkDeclaration } from '@core/plugin/consent/plugin-network-declaration';

/**
 * What a plugin asks for, as data the consent dialog renders. Code computes facts and risk; the words
 * an operator reads live in the console's dictionaries, keyed by entry.
 */
export class PluginConsentSummary {
  private static readonly RANK = [PluginConsentRisk.HIGH.value, PluginConsentRisk.MEDIUM.value, PluginConsentRisk.LOW.value];

  /**
   * @param approved what is approved now — empty for a plugin not installed yet.
   * @param collections the collection slugs the plugin defines, when known (an installed plugin).
   */
  static of(manifest: IPluginManifest, approved: readonly string[] = [], collections: string[] = []): IPluginConsentSummary {
    const consent = PluginConsentSet.of(manifest);
    const held = new Set(approved.map((entry) => String(entry).toLowerCase()));
    const entries = consent
      .map((entry) => PluginConsentSummary.entry(entry, !PluginConsentSet.holds(held, entry)))
      .sort((a, b) => PluginConsentSummary.RANK.indexOf(a.risk) - PluginConsentSummary.RANK.indexOf(b.risk) || a.entry.localeCompare(b.entry));
    const sandbox = manifest.sandbox;
    const sandboxConfig = sandbox && typeof sandbox === 'object' ? sandbox : null;
    return {
      slug: manifest.slug,
      name: manifest.name || manifest.slug,
      version: manifest.version || '',
      entries,
      consent,
      requiresApproval: entries.some((entry) => entry.isNew),
      dropped: [...held].filter((entry) => !consent.includes(entry)).sort(),
      anyHostReason: PluginNetworkDeclaration.anyHostReason(manifest),
      invalidHosts: PluginNetworkDeclaration.invalidHosts(manifest),
      collections: [...new Set(collections)].sort(),
      adminScreens: Boolean(manifest.admin?.menu?.length || manifest.admin?.collections?.length || manifest.ui?.entry),
      storefrontWidgets: Array.isArray(manifest.ui?.widgets) ? manifest.ui!.widgets!.length : 0,
      storefrontCode: Boolean((manifest.ui as any)?.frontendEntry || manifest.ui?.headInjections?.length || manifest.ui?.publicRoutes?.length),
      storefrontHosts: [...new Set((manifest.ui?.storefrontHosts || []).map((host) => String(host).trim().toLowerCase()).filter((host) => PluginNetworkDeclaration.isHost(host)))].sort(),
      isolated: sandbox !== false && !(sandboxConfig && (sandboxConfig as any).enabled === false),
      memoryLimitMb: typeof sandboxConfig?.memoryLimit === 'number' ? sandboxConfig.memoryLimit : null,
      timeoutMs: typeof sandboxConfig?.timeout === 'number' ? sandboxConfig.timeout : null,
    };
  }

  private static entry(entry: string, isNew: boolean): IPluginConsentEntry {
    if (entry === PluginNetworkDeclaration.ANY_TOKEN) {
      return { entry, kind: PluginConsentEntryKind.ANY_HOST.value, host: '', risk: PluginConsentRisk.HIGH.value, isNew };
    }
    if (entry.startsWith(PluginNetworkDeclaration.HOST_TOKEN_PREFIX)) {
      const host = entry.slice(PluginNetworkDeclaration.HOST_TOKEN_PREFIX.length);
      return { entry, kind: PluginConsentEntryKind.HOST.value, host, risk: PluginConsentRisk.MEDIUM.value, isNew };
    }
    return { entry, kind: PluginConsentEntryKind.CAPABILITY.value, host: '', risk: PluginCapabilityRisk.of(entry).value, isNew };
  }
}
