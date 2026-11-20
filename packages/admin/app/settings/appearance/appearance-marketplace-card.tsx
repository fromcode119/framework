import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AppearanceCatalogItem } from '@/app/settings/appearance/appearance-catalog-item';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Marketplace appearances not yet installed — browse and install with one click. */
export class AppearanceMarketplaceCard extends PureReactor {
  @prop declare entries: AppearanceCatalogItem[];
  @prop declare busy: boolean;
  @prop declare dark: boolean;
  @prop declare onInstall: (slug: string) => void;

  render(): ReactNode {
    if (!this.entries.length) return null;
    return (
      <Card title={AdminI18n.t('settings.appearance.availableInTheMarketplace')}>
        {this.entries.map((it) => (
          <div key={it.slug} className={`py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b last:border-0 fc-tone-line`}>
            <div className="flex items-start gap-4">
              <span className={`p-2.5 rounded-xl h-fit fc-tone-brand-soft fc-tone-brand`}>
                <FrameworkIcons.Palette size={18} />
              </span>
              <div>
                <span className={`block text-sm font-medium tracking-tight fc-tone-text`}>{it.name}{it.version ? ` · v${it.version}` : ''}</span>
                <span className="block fc-size-sm fc-tone-muted max-w-md leading-relaxed">{it.description || it.author}</span>
              </div>
            </div>
            <Button icon={<FrameworkIcons.Download size={14} />} onClick={() => this.onInstall(it.slug)} disabled={this.busy}>{AdminI18n.t('settings.appearance.install')}</Button>
          </div>
        ))}
      </Card>
    );
  }
}
