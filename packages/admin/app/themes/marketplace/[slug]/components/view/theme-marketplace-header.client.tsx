import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Text } from '@/components/ui/view/text.client';
import { Select } from '@/components/ui/view/select.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What a theme of the catalogue is: its name in the card's head, what it is for, who made it and which
 * version is on show — with the other versions to choose from when the catalogue has them.
 */
export class ThemeMarketplaceHeader extends PureReactor {
  declare props: Pick<ThemeMarketplaceHeader, 'theme' | 'allVersions' | 'selectedVersion' | 'onSelectVersion'>;

  @prop declare theme: IMarketplaceTheme;
  @prop declare allVersions: IMarketplaceTheme[];
  @prop declare selectedVersion: string;
  @prop declare onSelectVersion: (version: string) => void;

  private versionLabel(version: string): string {
    return `v${version}${version === this.allVersions[0]?.version ? ` ${AdminI18n.t('themes.latest')}` : ''}`;
  }

  render(): ReactNode {
    const { theme, allVersions, selectedVersion, onSelectVersion } = this;
    const facts = [
      ...(theme.author ? [{ key: 'author', label: AdminI18n.t('themes.creator'), value: String(theme.author) }] : []),
      { key: 'version', label: AdminI18n.t('themes.version'), value: this.versionLabel(selectedVersion || theme.version) },
      ...(theme.authorUrl ? [{ key: 'portal', label: AdminI18n.t('themes.developerPortal'), value: String(theme.authorUrl) }] : []),
    ];
    return (
      <RecordCard title={theme.name}>
        <div className="fc-stack">
          {theme.description ? <Text size="base">{theme.description}</Text> : null}
          <AdminFactGrid facts={facts as any} />
          {allVersions.length > 1 ? (
            <div className="fc-form-grid">
              <Select label={AdminI18n.t('themes.version')} value={selectedVersion} onChange={onSelectVersion}
                options={allVersions.map((v) => ({ value: v.version, label: this.versionLabel(v.version) }))} />
            </div>
          ) : null}
        </div>
      </RecordCard>
    );
  }
}
