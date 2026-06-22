import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AppearanceMarketplaceCardProps } from './appearance-marketplace-card.interfaces';

/** Marketplace appearances not yet installed — browse and install with one click. */
export class AppearanceMarketplaceCard extends React.Component<AppearanceMarketplaceCardProps> {
  render(): React.ReactNode {
    const { entries, busy, dark, onInstall } = this.props;
    if (!entries.length) return null;
    return (
      <Card title="Available in the marketplace">
        {entries.map((it) => (
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
            <Button icon={<FrameworkIcons.Download size={14} />} onClick={() => onInstall(it.slug)} disabled={busy}>Install</Button>
          </div>
        ))}
      </Card>
    );
  }
}
