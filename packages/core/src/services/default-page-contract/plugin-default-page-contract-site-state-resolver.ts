import type {
  PluginDefaultPageContractResolutionInput,
  PluginDefaultPageContractResolutionSource,
  PluginDefaultPageContractResolutionStatus,
  PluginDefaultPageContractSiteStateEntry,
  PluginDefaultPageContractSiteStateMatch,
  RegisteredPluginDefaultPageContract,
} from '../../types';

/**
 * Derives the site-state-driven status/prerequisite/reason fields for a single resolved
 * default-page contract. Extracted from {@link PluginDefaultPageContractResolutionService};
 * the resolution outcomes are unchanged.
 */
export class PluginDefaultPageContractSiteStateResolver {
  getSiteStateEntries(
    entry: RegisteredPluginDefaultPageContract,
    siteState?: PluginDefaultPageContractResolutionInput['siteState'],
  ): PluginDefaultPageContractSiteStateEntry[] {
    const entries: PluginDefaultPageContractSiteStateEntry[] = [];
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
    entry: RegisteredPluginDefaultPageContract,
    siteState?: PluginDefaultPageContractResolutionInput['siteState'],
  ): PluginDefaultPageContractSiteStateMatch {
    const hasCanonicalKeyMatch = Boolean(siteState?.byCanonicalKey?.[entry.canonicalKey]);
    const hasCapabilityMatch = Boolean(siteState?.byCapability?.[entry.capability]);

    if (hasCanonicalKeyMatch && hasCapabilityMatch) {
      return 'both';
    }

    if (hasCanonicalKeyMatch) {
      return 'canonicalKey';
    }

    if (hasCapabilityMatch) {
      return 'capability';
    }

    return 'none';
  }

  getSiteStateStatus(
    siteStateEntries: PluginDefaultPageContractSiteStateEntry[],
  ): PluginDefaultPageContractResolutionStatus | undefined {
    if (siteStateEntries.some((entry) => entry.status === 'blocked')) {
      return 'blocked';
    }

    if (siteStateEntries.some((entry) => entry.status === 'skipped')) {
      return 'skipped';
    }

    if (siteStateEntries.some((entry) => entry.status === 'ready')) {
      return 'ready';
    }

    return undefined;
  }

  getPrerequisiteReady(
    install: boolean,
    siteStateEntries: PluginDefaultPageContractSiteStateEntry[],
    siteStateStatus?: PluginDefaultPageContractResolutionStatus,
  ): boolean {
    if (!install) {
      return false;
    }

    if (siteStateStatus === 'blocked' || siteStateStatus === 'skipped') {
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
      return 'skipped';
    }

    if (siteStateStatus === 'blocked' || siteStateStatus === 'skipped') {
      return siteStateStatus;
    }

    if (!prerequisiteReady) {
      return 'blocked';
    }

    return 'ready';
  }

  getReasons(
    install: boolean,
    siteStateEntries: PluginDefaultPageContractSiteStateEntry[],
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

    if (status === 'blocked') {
      return ['prerequisites-not-ready'];
    }

    if (status === 'skipped') {
      return ['site-state-skipped'];
    }

    return [];
  }

  getStatusSource(
    install: boolean,
    installSource: PluginDefaultPageContractResolutionSource,
    siteStateEntries: PluginDefaultPageContractSiteStateEntry[],
    siteStateStatus: PluginDefaultPageContractResolutionStatus | undefined,
    prerequisiteReady: boolean,
  ): PluginDefaultPageContractResolutionSource {
    if (!install) {
      return installSource;
    }

    if (siteStateEntries.length && (siteStateStatus === 'blocked' || siteStateStatus === 'skipped' || !prerequisiteReady)) {
      return 'site-state';
    }

    return installSource;
  }

  getPrerequisiteSource(
    install: boolean,
    siteStateEntries: PluginDefaultPageContractSiteStateEntry[],
  ): PluginDefaultPageContractResolutionSource {
    if (!install) {
      return 'declaration';
    }

    return siteStateEntries.length ? 'site-state' : 'declaration';
  }

  private cloneSiteStateEntry(entry: PluginDefaultPageContractSiteStateEntry): PluginDefaultPageContractSiteStateEntry {
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
