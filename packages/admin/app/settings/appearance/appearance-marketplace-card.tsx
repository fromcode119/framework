import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AppearanceCatalogItem } from '@/app/settings/appearance/appearance-catalog-item';

/** Marketplace appearances not yet installed — browse and install with one click. */
export class AppearanceMarketplaceCard extends PureReactor {
  @prop declare entries: AppearanceCatalogItem[];
  @prop declare busy: boolean;
  @prop declare dark: boolean;
  @prop declare onInstall: (slug: string) => void;

  render(): ReactNode {
    const dark = this.dark;
    if (!this.entries.length) return null;
    return (
      <Card title="Available in the marketplace">
        {this.entries.map((it) => (
          <div key={it.slug} className={`py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b last:border-0 ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-start gap-4">
              <span className={`p-2.5 rounded-xl h-fit ${dark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.Palette size={18} />
              </span>
              <div>
                <span className={`block text-sm font-semibold tracking-tight ${dark ? 'text-slate-200' : 'text-slate-900'}`}>{it.name}{it.version ? ` · v${it.version}` : ''}</span>
                <span className="block text-[13px] text-slate-500 max-w-md leading-relaxed">{it.description || it.author}</span>
              </div>
            </div>
            <Button icon={<FrameworkIcons.Download size={14} />} onClick={() => this.onInstall(it.slug)} disabled={this.busy}>Install</Button>
          </div>
        ))}
      </Card>
    );
  }
}
