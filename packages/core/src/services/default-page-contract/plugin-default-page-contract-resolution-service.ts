import type {
  PluginDefaultPageContractResolutionInput,
  RegisteredPluginDefaultPageContract,
  ResolvedPluginDefaultPageContract,
  ThemeDefaultPageContractOverride,
} from '../../types';
import { BaseService } from '../base-service';
import { PluginDefaultPageContractRegistryService } from './plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractSiteStateResolver } from './plugin-default-page-contract-site-state-resolver';

export class PluginDefaultPageContractResolutionService extends BaseService {
  private readonly siteStateResolver = new PluginDefaultPageContractSiteStateResolver();

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
      styleVariant: this.normalizeOptionalString(override.styleVariant),
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
    const siteStateEntries = this.siteStateResolver.getSiteStateEntries(entry, inputSiteState);
    const siteStateMatch = this.siteStateResolver.getSiteStateMatch(entry, inputSiteState);
    const installSource = override && typeof override.install === 'boolean' ? 'theme-override' : 'declaration';
    const install = typeof override?.install === 'boolean' ? override.install : entry.required;
    const siteStateStatus = this.siteStateResolver.getSiteStateStatus(siteStateEntries);
    const prerequisiteReady = this.siteStateResolver.getPrerequisiteReady(install, siteStateEntries, siteStateStatus);
    const status = this.siteStateResolver.getResolvedStatus(install, siteStateStatus, prerequisiteReady);
    const statusSource = this.siteStateResolver.getStatusSource(install, installSource, siteStateEntries, siteStateStatus, prerequisiteReady);

    return {
      ...entry,
      dependencies: [...entry.dependencies],
      adoptionHints: [...entry.adoptionHints],
      aliases: entry.aliases ? [...entry.aliases] : undefined,
      effectiveSlug: override?.slug || entry.defaultSlug,
      effectiveAliases: override?.aliases ? [...override.aliases] : [...(entry.aliases || [])],
      effectiveRecipe: override?.recipe || entry.recipe,
      effectiveTitle: override?.title || entry.title,
      effectiveStyleVariant: override?.styleVariant || entry.styleVariant,
      effectiveThemeLayout: override?.themeLayout || entry.themeLayout,
      install,
      prerequisiteReady,
      status,
      reasons: this.siteStateResolver.getReasons(install, siteStateEntries, status),
      sources: {
        effectiveSlug: override?.slug ? 'theme-override' : 'declaration',
        effectiveAliases: override?.aliases ? 'theme-override' : 'declaration',
        effectiveRecipe: override?.recipe ? 'theme-override' : 'declaration',
        effectiveTitle: override?.title ? 'theme-override' : 'declaration',
        effectiveStyleVariant: override?.styleVariant ? 'theme-override' : 'declaration',
        effectiveThemeLayout: override?.themeLayout ? 'theme-override' : 'declaration',
        install: installSource,
        prerequisiteReady: this.siteStateResolver.getPrerequisiteSource(install, siteStateEntries),
        status: statusSource,
      },
      provenance: {
        overrideApplied: Boolean(override),
        overrideCanonicalKey: override ? entry.canonicalKey : undefined,
        siteStateMatch,
      },
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