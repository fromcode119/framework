import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { DetailBox } from '@/components/view/detail-box.client';
import { ThemePreviewSwatch } from '@/app/themes/[slug]/theme-preview-swatch';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The theme's colour variables as they stand in the editor — each swatch named by its own field's label. */
export class ThemeOverviewColours extends PureReactor {
  @prop declare swatches: ThemePreviewSwatch[];
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <DetailBox title={AdminI18n.t('themes.themeColors')} theme={this.theme}>
        {this.swatches.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {this.swatches.map((swatch) => (
              <div key={swatch.key} className="min-w-0">
                <div className={`h-14 rounded-lg border ${dark ? 'border-white/10' : 'border-black/5'}`} style={{ backgroundColor: swatch.value }} />
                <div className={`mt-1.5 truncate text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`} title={swatch.label}>{swatch.label}</div>
                <div className={`font-mono text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{swatch.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`py-1.5 text-[13px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{AdminI18n.t('themes.thisThemeDeclaresNoColor')}</p>
        )}
      </DetailBox>
    );
  }
}
