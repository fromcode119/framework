import { Text } from '@/components/ui/view/text.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
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
    return (
      <DetailBox title={AdminI18n.t('themes.themeColors')} theme={this.theme}>
        {this.swatches.length ? (
          <div className="fc-swatches">
            {this.swatches.map((swatch) => (
              <div key={swatch.key} className="fc-swatch">
                <div className="fc-swatch__chip" style={{ backgroundColor: swatch.value }} />
                <Text size="xsmall" weight="plus" as="div" className="fc-swatch__name">{swatch.label}</Text>
                <Text size="xsmall" muted as="div"><code className="fc-dt-code">{swatch.value}</code></Text>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState inline title={AdminI18n.t('themes.thisThemeDeclaresNoColor')} />
        )}
      </DetailBox>
    );
  }
}
