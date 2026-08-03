
import type { ICollection, IResolvedPluginDefaultPageContract } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { ResolutionContractPresentationService } from '@api/services/helpers/resolution-contract-presentation-service';
import { ResolutionContractPathService } from '@api/services/helpers/resolution-contract-path-service';
import { PluginDefaultPageContractMaterializationMode } from '@fromcode119/core';
import { PluginDefaultPageContractResolutionStatus } from '@fromcode119/core';

export class ResolutionContractMatchService {
  constructor(private readonly restController: RESTController) {}

  async resolve(
    normalizedInput: string,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
    withLocale: (query: any) => any,
    options: {
      user?: any;
      preview?: boolean;
      locale?: string;
      fallback_locale?: string;
      locale_mode?: string;
    },
  ): Promise<{ type: string; plugin: string; doc: any } | null> {
    for (const contract of resolvedContracts) {
      if (!contract.install || contract.status !== PluginDefaultPageContractResolutionStatus.READY) {
        continue;
      }

      if (contract.materializationMode !== PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT) {
        continue;
      }

      const matchingPattern = ResolutionContractPathService.findMatchingPattern(contract, normalizedInput);
      if (!matchingPattern) {
        continue;
      }

      if (ResolutionContractPathService.hasPathParameters(matchingPattern)) {
        // Record-backed detail (e.g. /shop/:slug) resolves the param to a record; a static "shell"
        // route with no recordCollection (e.g. /account/:section) consumes the param client-side and
        // resolves to its base singleton page (the AccountShell host page).
        const parameterizedMatch = String(contract.recordCollection || '').trim()
          ? await this.resolveDetailMatch(
              contract,
              matchingPattern,
              normalizedInput,
              collections,
              activePlugins,
              withLocale,
              options,
            )
          : await this.resolveShellMatch(
              contract,
              matchingPattern,
              collections,
              activePlugins,
              withLocale,
              options,
            );
        if (parameterizedMatch) {
          return parameterizedMatch;
        }
        continue;
      }

      const singletonMatch = await this.resolveSingletonMatch(
        contract,
        collections,
        activePlugins,
        withLocale,
        options,
      );
      if (singletonMatch) {
        return singletonMatch;
      }
    }

    return null;
  }

  private async resolveSingletonMatch(
    contract: IResolvedPluginDefaultPageContract,
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
    withLocale: (query: any) => any,
    options: {
      user?: any;
      preview?: boolean;
    },
  ): Promise<{ type: string; plugin: string; doc: any } | null> {
    const collectionEntry = this.findPagesCollectionEntry(collections, activePlugins);
    const slugValue = this.resolveSingletonSlugValue(contract);
    if (!collectionEntry || !slugValue) {
      return null;
    }

    const result: any = await this.restController.find(collectionEntry.collection, {
      query: withLocale({
        slug: slugValue,
        limit: 1,
        preview: options.preview ? '1' : '0',
      }),
      user: options.user,
    } as any);

    if (result?.docs?.length > 0) {
      return {
        type: collectionEntry.collection.shortSlug || collectionEntry.collection.slug,
        plugin: collectionEntry.pluginSlug,
        doc: ResolutionContractPresentationService.applyToDoc(result.docs[0], contract),
      };
    }

    return null;
  }

  private async resolveDetailMatch(
    contract: IResolvedPluginDefaultPageContract,
    matchingPattern: string,
    normalizedInput: string,
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
    withLocale: (query: any) => any,
    options: {
      user?: any;
      preview?: boolean;
    },
  ): Promise<{ type: string; plugin: string; doc: any } | null> {
    const routeParameters = ResolutionContractPathService.extractPathParameters(matchingPattern, normalizedInput);
    const recordSlug = String(routeParameters.slug || '').trim();
    const collectionEntry = this.findContractCollectionEntry(contract, collections, activePlugins);
    if (!recordSlug || !collectionEntry || !collectionEntry.collection.fields.some((field) => field.name === 'slug')) {
      return null;
    }

    const result: any = await this.restController.find(collectionEntry.collection, {
      query: withLocale({
        slug: recordSlug,
        limit: 1,
        preview: options.preview ? '1' : '0',
      }),
      user: options.user,
    } as any);

    if (result?.docs?.length > 0) {
      const routableDoc = result.docs.find((doc: any) => this.isRoutableDetailRecord(doc, collectionEntry.collection, options.preview));
      if (!routableDoc) {
        return null;
      }

      return {
        type: collectionEntry.collection.shortSlug || collectionEntry.collection.slug,
        plugin: collectionEntry.pluginSlug,
        doc: ResolutionContractPresentationService.applyToDoc(routableDoc, contract),
      };
    }

    return null;
  }

  private async resolveShellMatch(
    contract: IResolvedPluginDefaultPageContract,
    matchingPattern: string,
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
    withLocale: (query: any) => any,
    options: {
      user?: any;
      preview?: boolean;
    },
  ): Promise<{ type: string; plugin: string; doc: any } | null> {
    const baseSlug = this.resolveShellBaseSlug(contract, matchingPattern);
    const collectionEntry = this.findPagesCollectionEntry(collections, activePlugins);
    if (!baseSlug || !collectionEntry) {
      return null;
    }

    const result: any = await this.restController.find(collectionEntry.collection, {
      query: withLocale({
        slug: baseSlug,
        limit: 1,
        preview: options.preview ? '1' : '0',
      }),
      user: options.user,
    } as any);

    if (result?.docs?.length > 0) {
      return {
        type: collectionEntry.collection.shortSlug || collectionEntry.collection.slug,
        plugin: collectionEntry.pluginSlug,
        doc: ResolutionContractPresentationService.applyToDoc(result.docs[0], contract),
      };
    }

    return null;
  }

  private resolveShellBaseSlug(contract: IResolvedPluginDefaultPageContract, matchingPattern: string): string | null {
    const source = String(matchingPattern || contract.effectiveSlug || '').trim();
    const segments = source.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const staticSegments = segments.filter((segment) => !segment.startsWith(':'));
    return staticSegments.length ? staticSegments[staticSegments.length - 1] : null;
  }

  private resolveSingletonSlugValue(contract: IResolvedPluginDefaultPageContract): string | null {
    const segments = String(contract.effectiveSlug || '').trim().split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => segment.startsWith(':'))) {
      return null;
    }

    return segments[segments.length - 1] || null;
  }

  private findContractCollectionEntry(
    contract: IResolvedPluginDefaultPageContract,
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
  ): { collection: ICollection; pluginSlug: string } | null {
    const expectedCollection = String(contract.recordCollection || '').trim();
    if (!expectedCollection) {
      return null;
    }

    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) {
        continue;
      }
      if (pluginSlug !== contract.pluginSlug) {
        continue;
      }
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) {
        continue;
      }

      const collectionNames = [collection.shortSlug, collection.slug]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      if (collectionNames.includes(expectedCollection)) {
        return { collection, pluginSlug };
      }
    }

    return null;
  }

  private findPagesCollectionEntry(
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    activePlugins: Set<string>,
  ): { collection: ICollection; pluginSlug: string } | null {
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) {
        continue;
      }
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) {
        continue;
      }
      if ((collection.shortSlug || collection.slug) === 'pages') {
        return { collection, pluginSlug };
      }
    }

    return null;
  }

  private isRoutableDetailRecord(doc: any, collection: ICollection, preview?: boolean): boolean {
    if (!doc || typeof doc !== 'object') {
      return false;
    }

    if (preview) {
      return true;
    }

    const fieldNames = new Set(
      Array.isArray(collection?.fields)
        ? collection.fields.map((field) => String(field?.name || '').trim()).filter(Boolean)
        : []
    );

    if (fieldNames.has('disablePermalink') && this.toBoolean(doc?.disablePermalink)) {
      return false;
    }

    if (fieldNames.has('disable_permalink') && this.toBoolean(doc?.disable_permalink)) {
      return false;
    }

    return true;
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === '1.0' || normalized === 'yes' || normalized === 'on';
  }
}