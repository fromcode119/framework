import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { AdminApi } from '@/lib/api';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Names the plugin whose design fills this storefront page while its Content Blocks are empty.
 *
 * A plugin's default page (`/cookies-policy`, `/shop`, …) is published with no blocks, and the site
 * shows the plugin's own design in their place. The editor used to show only the empty block list, so
 * the live page had no source an operator could see (Rule Zero). The framework answers from the same
 * match the storefront uses; this card only reports it, and renders nothing for an ordinary page.
 */
export class PageDesignCard extends Reactor {
  @prop declare collectionSlug: string;
  @prop declare recordId: string;
  @prop declare content: unknown;

  @state private design: { pluginSlug: string; pluginName: string; title: string } | null = null;

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.collectionSlug || !this.recordId) return;
    try {
      const response: any = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PAGE_DESIGN(this.collectionSlug, this.recordId));
      this.design = response?.design ?? null;
    } catch {
      // No answer is not "no design": say nothing rather than claim the page is ordinary.
      this.design = null;
    }
  }

  /** No blocks anywhere: nothing, an empty list, blank text, or a per-locale map of those. */
  private static isBlank(content: unknown): boolean {
    if (content === null || content === undefined) return true;
    if (Array.isArray(content)) return content.length === 0;
    if (content instanceof Object) return Object.values(content).every((value) => PageDesignCard.isBlank(value));
    return String(content).trim().length === 0;
  }

  render(): ReactNode {
    const design = this.design;
    if (!design) return null;
    const page = design.title || AdminI18n.t('collection.pageDesign.thisPage');
    const blank = PageDesignCard.isBlank(this.content);
    return (
      <Card title={AdminI18n.t('collection.pageDesign.title')}>
        <p className="text-sm text-slate-500 leading-relaxed">
          {AdminI18n.t('collection.pageDesign.defaultOf', { page, plugin: design.pluginName })}{' '}
          {blank
            ? AdminI18n.t('collection.pageDesign.blank', { plugin: design.pluginName })
            : AdminI18n.t('collection.pageDesign.replaced', { plugin: design.pluginName })}
        </p>
        <a
          href={AdminPathUtils.toAdminPath(`/plugins/${design.pluginSlug}`)}
          className="mt-3 inline-block text-[12px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          {AdminI18n.t('collection.pageDesign.open', { plugin: design.pluginName })}
        </a>
      </Card>
    );
  }
}
