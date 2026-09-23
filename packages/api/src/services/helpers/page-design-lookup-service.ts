import { StorefrontPagesCollection, type IResolvedPluginDefaultPageContract, type PluginManager } from '@fromcode119/core';
import type { RESTController } from '@api/controllers/rest/rest-controller';
import { ExactPageContractPresenter } from '@api/services/helpers/exact-page-contract-presenter';
import type { IPageDesign } from '@api/services/helpers/interfaces/page-design.interface';

/**
 * Which plugin's design a storefront page shows while its content is empty — the admin's half of
 * {@link ExactPageContractPresenter}.
 *
 * The storefront fills a blank contract page with its plugin's design; the page editor showed the same
 * page as an empty block list and said nothing, so an operator could not tell where the live page came
 * from. This answers from the SAME match the storefront uses (the record's path against this site's
 * singleton contracts), so the admin can never name a design the storefront would not render.
 */
export class PageDesignLookupService {
  constructor(
    private readonly manager: PluginManager,
    private readonly restController: RESTController,
  ) {}

  async find(
    collectionSlug: string,
    id: string,
    user: unknown,
    contracts: () => Promise<IResolvedPluginDefaultPageContract[]>,
  ): Promise<IPageDesign | null> {
    const owner = StorefrontPagesCollection.find(this.manager.registeredCollections);
    if (!owner || !id || owner.collection.slug !== collectionSlug) return null;

    // Read through the REST layer with the caller's identity: someone who cannot open the page learns
    // nothing about it here either.
    const result: any = await this.restController.find(owner.collection, { query: { id, limit: 1 }, user } as any);
    const doc = result?.docs?.[0];
    if (!doc) return null;

    const path = PageDesignLookupService.pathOf(doc);
    if (!path) return null;
    const contract = ExactPageContractPresenter.findSingleton(await contracts(), path);
    if (!contract?.effectiveRecipe) return null;

    const plugin = this.manager.getPlugins().find((entry: any) => entry?.manifest?.slug === contract.pluginSlug);
    return {
      pluginSlug: contract.pluginSlug,
      pluginName: String(plugin?.manifest?.name || contract.pluginSlug),
      title: String(contract.effectiveTitle || ''),
    };
  }

  private static pathOf(doc: Record<string, unknown>): string {
    const permalink = String(doc.customPermalink ?? '').trim();
    if (permalink) return permalink.startsWith('/') ? permalink : `/${permalink}`;
    const slug = String(doc.slug ?? '').trim();
    return slug ? `/${slug}` : '';
  }
}
