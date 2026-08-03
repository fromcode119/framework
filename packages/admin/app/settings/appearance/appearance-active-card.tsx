import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AppearanceItem } from '@/app/settings/appearance/appearance-item';
import { AppearanceCatalogItem } from '@/app/settings/appearance/appearance-catalog-item';

/** The installed appearances (default + installed) with the active radio, update badge, and remove. */
export class AppearanceActiveCard extends PureReactor {
  @prop declare items: AppearanceItem[];
  @prop declare catalogBySlug: Record<string, AppearanceCatalogItem>;
  @prop declare active: string;
  @prop declare busy: boolean;
  @prop declare dark: boolean;
  @prop declare onSwitch: (slug: string) => void;
  @prop declare onUpdate: (item: AppearanceItem) => void;
  @prop declare onRemove: (slug: string) => void;

  private subtitle(item: AppearanceItem): string {
    if (item.builtIn) return 'Built-in';
    return item.version ? `v${item.version}` : 'Installed';
  }

  render(): ReactNode {
    const { items, catalogBySlug, active, busy, dark, onSwitch, onUpdate, onRemove } = this;
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
                    <Button variant={catalog?.updateAvailable ? ButtonVariant.PRIMARY : ButtonVariant.GHOST} icon={<FrameworkIcons.Refresh size={14} />} onClick={() => onUpdate(it)} disabled={busy}>
                      {catalog?.updateAvailable ? `Update to v${catalog.version}` : 'Re-install'}
                    </Button>
                  )}
                  <Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Trash size={14} />} onClick={() => onRemove(it.slug)} disabled={busy}>Remove</Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    );
  }
}
