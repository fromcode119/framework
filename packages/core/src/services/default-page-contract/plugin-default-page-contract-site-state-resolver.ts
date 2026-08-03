import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractSiteStateMatch } from '@core/default-page-contract/enums/plugin-default-page-contract-site-state-match.enum';
import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';
import type { IPluginDefaultPageContractResolutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-input.interface';
import type { IPluginDefaultPageContractSiteStateEntry } from '@core/default-page-contract/interfaces/plugin-default-page-contract-site-state-entry.interface';
import type { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';

/**
 * Derives the site-state-driven status/prerequisite/reason fields for a single resolved
 * default-page contract. Extracted from {@link PluginDefaultPageContractResolutionService};
 * the resolution outcomes are unchanged.
 */
export class PluginDefaultPageContractSiteStateResolver {
  getSiteStateEntries(
    entry: IRegisteredPluginDefaultPageContract,
    siteState?: IPluginDefaultPageContractResolutionInput['siteState'],
  ): IPluginDefaultPageContractSiteStateEntry[] {
    const entries: IPluginDefaultPageContractSiteStateEntry[] = [];
    const canonicalEntry = siteState?.byCanonicalKey?.[entry.canonicalKey];
    const capabilityEntry = siteState?.byCapability?.[entry.capability];

    if (canonicalEntry) {
      entries.push(this.cloneSiteStateEntry(canonicalEntry));
    }

    if (capabilityEntry) {
      entries.push(this.cloneSiteStateEntry(capabilityEntry));
    }

    return entries;
  }

  getSiteStateMatch(
    entry: IRegisteredPluginDefaultPageContract,
    siteState?: IPluginDefaultPageContractResolutionInput['siteState'],
  ): PluginDefaultPageContractSiteStateMatch {
    const hasCanonicalKeyMatch = Boolean(siteState?.byCanonicalKey?.[entry.canonicalKey]);
    const hasCapabilityMatch = Boolean(siteState?.byCapability?.[entry.capability]);

    if (hasCanonicalKeyMatch && hasCapabilityMatch) {
      return PluginDefaultPageContractSiteStateMatch.BOTH;
    }

    if (hasCanonicalKeyMatch) {
      return PluginDefaultPageContractSiteStateMatch.CANONICAL_KEY;
    }

    if (hasCapabilityMatch) {
      return PluginDefaultPageContractSiteStateMatch.CAPABILITY;
    }

    return PluginDefaultPageContractSiteStateMatch.NONE;
  }

  getSiteStateStatus(
    siteStateEntries: IPluginDefaultPageContractSiteStateEntry[],
  ): PluginDefaultPageContractResolutionStatus | undefined {
    if (siteStateEntries.some((entry) => entry.status === PluginDefaultPageContractResolutionStatus.BLOCKED)) {
      return PluginDefaultPageContractResolutionStatus.BLOCKED;
    }

    if (siteStateEntries.some((entry) => entry.status === PluginDefaultPageContractResolutionStatus.SKIPPED)) {
      return PluginDefaultPageContractResolutionStatus.SKIPPED;
    }

    if (siteStateEntries.some((entry) => entry.status === PluginDefaultPageContractResolutionStatus.READY)) {
      return PluginDefaultPageContractResolutionStatus.READY;
    }

    return undefined;
  }

  getPrerequisiteReady(
    install: boolean,
    siteStateEntries: IPluginDefaultPageContractSiteStateEntry[],
    siteStateStatus?: PluginDefaultPageContractResolutionStatus,
  ): boolean {
    if (!install) {
      return false;
    }

    if (siteStateStatus === PluginDefaultPageContractResolutionStatus.BLOCKED
      || siteStateStatus === PluginDefaultPageContractResolutionStatus.SKIPPED) {
      return false;
    }

    return !siteStateEntries.some((entry) => entry.prerequisitesReady === false);
  }

  getResolvedStatus(
    install: boolean,
    siteStateStatus: PluginDefaultPageContractResolutionStatus | undefined,
    prerequisiteReady: boolean,
  ): PluginDefaultPageContractResolutionStatus {
    if (!install) {
      return PluginDefaultPageContractResolutionStatus.SKIPPED;
    }

    if (siteStateStatus === PluginDefaultPageContractResolutionStatus.BLOCKED
      || siteStateStatus === PluginDefaultPageContractResolutionStatus.SKIPPED) {
      return siteStateStatus;
    }

    if (!prerequisiteReady) {
      return PluginDefaultPageContractResolutionStatus.BLOCKED;
    }

    return PluginDefaultPageContractResolutionStatus.READY;
  }

  getReasons(
    install: boolean,
    siteStateEntries: IPluginDefaultPageContractSiteStateEntry[],
    status: PluginDefaultPageContractResolutionStatus,
  ): string[] {
    if (!install) {
      return ['install-disabled'];
    }

    const reasons = Array.from(
      new Set(
        siteStateEntries.flatMap((entry) => {
          return (entry.reasons || []).map((reason) => String(reason || '').trim()).filter(Boolean);
        }),
      ),
    );

    if (reasons.length) {
      return reasons;
    }

    if (status === PluginDefaultPageContractResolutionStatus.BLOCKED) {
      return ['prerequisites-not-ready'];
    }

    if (status === PluginDefaultPageContractResolutionStatus.SKIPPED) {
      return ['site-state-skipped'];
    }

    return [];
  }

  getStatusSource(
    install: boolean,
    installSource: PluginDefaultPageContractResolutionSource,
    siteStateEntries: IPluginDefaultPageContractSiteStateEntry[],
    siteStateStatus: PluginDefaultPageContractResolutionStatus | undefined,
    prerequisiteReady: boolean,
  ): PluginDefaultPageContractResolutionSource {
    if (!install) {
      return installSource;
    }

    if (siteStateEntries.length
      && (siteStateStatus === PluginDefaultPageContractResolutionStatus.BLOCKED
        || siteStateStatus === PluginDefaultPageContractResolutionStatus.SKIPPED
        || !prerequisiteReady)) {
      return PluginDefaultPageContractResolutionSource.SITE_STATE;
    }

    return installSource;
  }

  getPrerequisiteSource(
    install: boolean,
    siteStateEntries: IPluginDefaultPageContractSiteStateEntry[],
  ): PluginDefaultPageContractResolutionSource {
    if (!install) {
      return PluginDefaultPageContractResolutionSource.DECLARATION;
    }

    return siteStateEntries.length ? PluginDefaultPageContractResolutionSource.SITE_STATE : PluginDefaultPageContractResolutionSource.DECLARATION;
  }

  private cloneSiteStateEntry(entry: IPluginDefaultPageContractSiteStateEntry): IPluginDefaultPageContractSiteStateEntry {
    return {
      prerequisitesReady: entry.prerequisitesReady,
      reasons: this.normalizeOptionalStringArray(entry.reasons),
      status: entry.status,
    };
  }

  private normalizeOptionalStringArray(values?: string[]): string[] | undefined {
    const normalized = Array.from(
      new Set(
        (values || [])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );

    return normalized.length ? normalized : undefined;
  }
}
