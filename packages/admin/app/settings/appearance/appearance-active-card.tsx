import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AppearanceActiveCardProps } from './appearance-active-card.interfaces';
import type { AppearanceItem } from './appearance-item.interfaces';

/** The installed appearances (default + installed) with the active radio, update badge, and remove. */
export class AppearanceActiveCard extends React.Component<AppearanceActiveCardProps> {
  private subtitle(item: AppearanceItem): string {
    if (item.builtIn) return 'Built-in';
    return item.version ? `v${item.version}` : 'Installed';
  }

  render(): React.ReactNode {
    const { items, catalogBySlug, active, busy, dark, onSwitch, onUpdate, onRemove } = this.props;
    return (
      <Card title="Active appearance">
        {items.map((it) => {
          const catalog = catalogBySlug[it.slug];
          const canUpdate = !it.builtIn && (!!catalog?.updateAvailable || !!it.sourceUrl);
          return (
            <div key={it.slug} className={`py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b last:border-0 ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
              <label className="flex items-center gap-4 cursor-pointer">
                <input type="radio" name="appearance" className="accent-indigo-600 w-4 h-4" checked={active === it.slug} onChange={() => onSwitch(it.slug)} disabled={busy} />
                <span className={`p-2.5 rounded-xl h-fit ${dark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <FrameworkIcons.Palette size={18} />
                </span>
                <span>
                  <span className={`block text-sm font-semibold tracking-tight ${dark ? 'text-slate-200' : 'text-slate-900'}`}>{it.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{this.subtitle(it)}</span>
                    {catalog?.updateAvailable && (
                      <span className="text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        Update · v{catalog.version}
                      </span>
                    )}
                  </span>
                </span>
              </label>
              {!it.builtIn && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canUpdate && (
                    <Button variant={catalog?.updateAvailable ? 'primary' : 'ghost'} icon={<FrameworkIcons.Refresh size={14} />} onClick={() => onUpdate(it)} disabled={busy}>
                      {catalog?.updateAvailable ? `Update to v${catalog.version}` : 'Re-install'}
                    </Button>
                  )}
                  <Button variant="ghost" icon={<FrameworkIcons.Trash size={14} />} onClick={() => onRemove(it.slug)} disabled={busy}>Remove</Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    );
  }
}
