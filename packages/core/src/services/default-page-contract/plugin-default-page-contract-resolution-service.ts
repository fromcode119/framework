import type { IPluginDefaultPageContractResolutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-input.interface';
import type { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';
import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import type { IThemeDefaultPageContractOverride } from '@core/default-page-contract/interfaces/theme-default-page-contract-override.interface';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageContractRegistryService } from '@core/services/default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractSiteStateResolver } from '@core/services/default-page-contract/plugin-default-page-contract-site-state-resolver';
import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';

export class PluginDefaultPageContractResolutionService extends BaseService {
  private readonly siteStateResolver = new PluginDefaultPageContractSiteStateResolver();

  constructor(private readonly registry: PluginDefaultPageContractRegistryService) {
    super();
  }

  get serviceName(): string {
    return 'PluginDefaultPageContractResolutionService';
  }

  resolveAll(input?: IPluginDefaultPageContractResolutionInput): IResolvedPluginDefaultPageContract[] {
    const overridesByKey = this.createOverrideMap(input?.overrides || []);
    const siteState = input?.siteState;

    return this.registry
      .list()
      .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey))
      .map((entry) => this.resolveEntry(entry, overridesByKey, siteState));
  }

  private createOverrideMap(overrides: IThemeDefaultPageContractOverride[]): Map<string, IThemeDefaultPageContractOverride> {
    const overrideMap = new Map<string, IThemeDefaultPageContractOverride>();

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

  private normalizeOverride(override: IThemeDefaultPageContractOverride): IThemeDefaultPageContractOverride {
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
    entry: IRegisteredPluginDefaultPageContract,
    overridesByKey: Map<string, IThemeDefaultPageContractOverride>,
    inputSiteState?: IPluginDefaultPageContractResolutionInput['siteState'],
  ): IResolvedPluginDefaultPageContract {
    const override = overridesByKey.get(entry.canonicalKey);
    const siteStateEntries = this.siteStateResolver.getSiteStateEntries(entry, inputSiteState);
    const siteStateMatch = this.siteStateResolver.getSiteStateMatch(entry, inputSiteState);
    const installSource = override && typeof override.install === 'boolean'
      ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE
      : PluginDefaultPageContractResolutionSource.DECLARATION;
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
        effectiveSlug: override?.slug ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
        effectiveAliases: override?.aliases ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
        effectiveRecipe: override?.recipe ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
        effectiveTitle: override?.title ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
        effectiveStyleVariant: override?.styleVariant ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
        effectiveThemeLayout: override?.themeLayout ? PluginDefaultPageContractResolutionSource.THEME_OVERRIDE : PluginDefaultPageContractResolutionSource.DECLARATION,
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