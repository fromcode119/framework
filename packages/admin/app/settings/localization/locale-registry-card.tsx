import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';

export class LocaleRegistryCard extends PureReactor {
  @prop declare locales: ILocaleItem[];
  @prop declare theme: ThemeMode;
  @prop declare updateLocale: (id: string, patch: Partial<ILocaleItem>) => void;
  @prop declare addLocale: () => void;
  @prop declare removeLocale: (id: string) => void;

  render(): ReactNode {
    const { locales, theme, updateLocale, removeLocale } = this;
    return (
      <Card title="Locale Registry">
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-500">
            Define language name + ISO code, then enable or disable each locale.
          </p>

          {/* An empty registry says so. It used to be impossible to see: the page seeded a hardcoded
              English row, so "nothing configured" was indistinguishable from "English configured". */}
          {locales.length === 0 && (
            <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
              No locales configured. Add one below; nothing is stored until you save.
            </p>
          )}

          <div className="space-y-3">
            {locales.map((locale) => (
              <div
                key={locale.id}
                className={`rounded-xl border p-4 ${
                  theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <Input
                      value={locale.name}
                      onChange={(e) => updateLocale(locale.id, { name: e.target.value })}
                      placeholder="Language name (e.g. English)"
                      className="font-semibold"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      value={locale.code}
                      onChange={(e) => updateLocale(locale.id, { code: e.target.value })}
                      placeholder="ISO code (e.g. en, en-gb)"
                      className="font-mono font-semibold"
                    />
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3">
                    <Switch
                      checked={locale.enabled}
                      onChange={(value) => updateLocale(locale.id, { enabled: value })}
                    />
                    <span className="text-sm font-medium text-slate-500 tracking-wide">Enabled</span>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLocale(locale.id)}
                      disabled={locales.length <= 1}
                      className={`px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                        locales.length <= 1
                          ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                          : theme === ThemeMode.DARK
                            ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3">
            <Button
              icon={<FrameworkIcons.Plus size={14} strokeWidth={3} />}
              onClick={this.addLocale}
              className="rounded-xl"
            >
              Add Locale
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
