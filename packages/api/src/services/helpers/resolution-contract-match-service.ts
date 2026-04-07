import type { Collection, ResolvedPluginDefaultPageContract } from '@fromcode119/core';
import { RESTController } from '../../controllers/rest-controller';
import { ResolutionContractPathService } from './resolution-contract-path-service';

export class ResolutionContractMatchService {
  constructor(private readonly restController: RESTController) {}

  async resolve(
    normalizedInput: string,
    resolvedContracts: ResolvedPluginDefaultPageContract[],
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
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
      if (!contract.install || contract.status !== 'ready') {
        continue;
      }

      if (contract.materializationMode !== 'singleton-document') {
        continue;
      }

      const matchingPattern = ResolutionContractPathService.findMatchingPattern(contract, normalizedInput);
      if (!matchingPattern) {
        continue;
      }

      if (ResolutionContractPathService.hasPathParameters(matchingPattern)) {
        const detailMatch = await this.resolveDetailMatch(
          contract,
          matchingPattern,
          normalizedInput,
          collections,
          activePlugins,
          withLocale,
          options,
        );
        if (detailMatch) {
          return detailMatch;
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
    contract: ResolvedPluginDefaultPageContract,
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
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
        doc: this.applyContractPresentation(result.docs[0], contract),
      };
    }

    return null;
  }

  private async resolveDetailMatch(
    contract: ResolvedPluginDefaultPageContract,
    matchingPattern: string,
    normalizedInput: string,
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
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
        doc: this.applyContractPresentation(routableDoc, contract),
      };
    }

    return null;
  }

  private resolveSingletonSlugValue(contract: ResolvedPluginDefaultPageContract): string | null {
    const segments = String(contract.effectiveSlug || '').trim().split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => segment.startsWith(':'))) {
      return null;
    }

    return segments[segments.length - 1] || null;
  }

  private findContractCollectionEntry(
    contract: ResolvedPluginDefaultPageContract,
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
    activePlugins: Set<string>,
  ): { collection: Collection; pluginSlug: string } | null {
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
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
    activePlugins: Set<string>,
  ): { collection: Collection; pluginSlug: string } | null {
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

  private applyContractPresentation(doc: any, contract: ResolvedPluginDefaultPageContract): any {
    if (!doc || typeof doc !== 'object') {
      return doc;
    }

    if (contract.effectiveThemeLayout && !doc.themeLayout && !doc.pageTemplate && !doc.page_template) {
      return {
        ...doc,
        themeLayout: contract.effectiveThemeLayout,
      };
    }

    return doc;
  }

  private isRoutableDetailRecord(doc: any, collection: Collection, preview?: boolean): boolean {
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