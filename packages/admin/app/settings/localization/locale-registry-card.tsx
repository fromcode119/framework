import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import type { LocaleRegistryCardProps } from './locale-registry-card.interfaces';

export class LocaleRegistryCard extends React.Component<LocaleRegistryCardProps> {
  render(): React.ReactNode {
    const { locales, theme, updateLocale, addLocale, removeLocale } = this.props;
    return (
      <Card title="Locale Registry">
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-500">
            Define language name + ISO code, then enable or disable each locale.
          </p>

          <div className="space-y-3">
            {locales.map((locale) => (
              <div
                key={locale.id}
                className={`rounded-xl border p-4 ${
                  theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'
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
                          : theme === 'dark'
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
              onClick={addLocale}
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
