import type {
  PluginDefaultPageContractResolutionInput,
  PluginDefaultPageContractResolutionSource,
  PluginDefaultPageContractResolutionStatus,
  PluginDefaultPageContractSiteStateEntry,
  PluginDefaultPageContractSiteStateMatch,
  RegisteredPluginDefaultPageContract,
  ResolvedPluginDefaultPageContract,
  ThemeDefaultPageContractOverride,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageContractRegistryService } from './plugin-default-page-contract-registry-service';

export class PluginDefaultPageContractResolutionService extends BaseService {
  constructor(private readonly registry: PluginDefaultPageContractRegistryService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageContractResolutionService';
  }

  resolveAll(input?: PluginDefaultPageContractResolutionInput): ResolvedPluginDefaultPageContract[] {
    const overridesByKey = this.createOverrideMap(input?.overrides || []);
    const siteState = input?.siteState;

    return this.registry
      .list()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((entry) => this.resolveEntry(entry, overridesByKey, siteState));
  }

  private createOverrideMap(overrides: ThemeDefaultPageContractOverride[]): Map<string, ThemeDefaultPageContractOverride> {
    const overrideMap = new Map<string, ThemeDefaultPageContractOverride>();

    for (const override of overrides) {
      const normalized = this.normalizeOverride(override);
      const canonicalKey = this.createCanonicalKey(normalized.contract.namespace, normalized.contract.pluginSlug, normalized.contract.key);

      if (overrideMap.has(canonicalKey)) {
        throw new Error(
          `[PluginDefaultPageContractResolutionService] duplicate theme override for default page contract: ${canonicalKey}`,
        );
      }

      overrideMap.set(canonicalKey, normalized);
    }

    return overrideMap;
  }

  private normalizeOverride(override: ThemeDefaultPageContractOverride): ThemeDefaultPageContractOverride {
    return {
      contract: {
        namespace: this.normalizeRequiredString(override.contract?.namespace, 'override.contract.namespace'),
        pluginSlug: this.normalizeRequiredString(override.contract?.pluginSlug, 'override.contract.pluginSlug'),
        key: this.normalizeRequiredString(override.contract?.key, 'override.contract.key'),
      },
      slug: this.normalizeOptionalString(override.slug),
      aliases: this.normalizeOptionalStringArray(override.aliases),
      title: this.normalizeOptionalString(override.title),
      themeLayout: this.normalizeOptionalString(override.themeLayout),
      recipe: this.normalizeOptionalString(override.recipe),
      install: typeof override.install === 'boolean' ? override.install : undefined,
    };
  }

  private resolveEntry(
    entry: RegisteredPluginDefaultPageContract,
    overridesByKey: Map<string, ThemeDefaultPageContractOverride>,
    inputSiteState?: PluginDefaultPageContractResolutionInput['siteState'],
  ): ResolvedPluginDefaultPageContract {
    const override = overridesByKey.get(entry.canonicalKey);
    const siteStateEntries = this.getSiteStateEntries(entry, inputSiteState);
    const siteStateMatch = this.getSiteStateMatch(entry, inputSiteState);
    const installSource = override && typeof override.install === 'boolean' ? 'theme-override' : 'declaration';
    const install = typeof override?.install === 'boolean' ? override.install : entry.required;
    const siteStateStatus = this.getSiteStateStatus(siteStateEntries);
    const prerequisiteReady = this.getPrerequisiteReady(install, siteStateEntries, siteStateStatus);
    const status = this.getResolvedStatus(install, siteStateStatus, prerequisiteReady);
    const statusSource = this.getStatusSource(install, installSource, siteStateEntries, siteStateStatus, prerequisiteReady);

    return {
      ...entry,
      dependencies: [...entry.dependencies],
      adoptionHints: [...entry.adoptionHints],
      aliases: entry.aliases ? [...entry.aliases] : undefined,
      effectiveSlug: override?.slug || entry.defaultSlug,
      effectiveAliases: override?.aliases ? [...override.aliases] : [...(entry.aliases || [])],
      effectiveRecipe: override?.recipe || entry.recipe,
      effectiveTitle: override?.title,
      effectiveThemeLayout: override?.themeLayout,
      install,
      prerequisiteReady,
      status,
      reasons: this.getReasons(install, siteStateEntries, status),
      sources: {
        effectiveSlug: override?.slug ? 'theme-override' : 'declaration',
        effectiveAliases: override?.aliases ? 'theme-override' : 'declaration',
        effectiveRecipe: override?.recipe ? 'theme-override' : 'declaration',
        effectiveTitle: override?.title ? 'theme-override' : 'declaration',
        effectiveThemeLayout: override?.themeLayout ? 'theme-override' : 'declaration',
        install: installSource,
        prerequisiteReady: this.getPrerequisiteSource(install, siteStateEntries),
        status: statusSource,
      },
      provenance: {
        overrideApplied: Boolean(override),
        overrideCanonicalKey: override ? entry.canonicalKey : undefined,
        siteStateMatch,
      },
    };
  }

  private getSiteStateEntries(
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

  private getSiteStateMatch(
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

  private getSiteStateStatus(
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

  private getPrerequisiteReady(
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

  private getResolvedStatus(
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

  private getReasons(
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

  private getStatusSource(
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

  private getPrerequisiteSource(
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

  private createCanonicalKey(namespace: string, pluginSlug: string, key: string): string {
    return `${namespace}:${pluginSlug}:${key}`;
  }

  private normalizeRequiredString(value: string | undefined, label: string): string {
    const normalized = String(value || '').trim();

    if (!normalized) {
      throw new Error(`[PluginDefaultPageContractResolutionService] ${label} must be a non-empty string`);
    }

    return normalized;
  }

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
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