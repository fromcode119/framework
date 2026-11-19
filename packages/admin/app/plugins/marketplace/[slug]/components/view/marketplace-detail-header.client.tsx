import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IPluginEntry } from '@fromcode119/core/client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Text } from '@/components/ui/view/text.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Select } from '@/components/ui/view/select.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What a plugin of the catalogue is: its name and kind in the card's head, what it does, who made it
 * and which version is on show — with the other versions to choose from when the catalogue has them.
 */
export class MarketplaceDetailHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<MarketplaceDetailHeader, 'plugin' | 'theme' | 'allVersions' | 'selectedVersion' | 'installedPlugin' | 'onSelectVersion'>;

  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;
  @prop declare allVersions: IPluginEntry[];
  @prop declare selectedVersion: string;
  @prop declare installedPlugin: any | null;
  @prop declare onSelectVersion: (version: string) => void;

  render(): ReactNode {
    const { plugin, allVersions, selectedVersion, installedPlugin, onSelectVersion } = this;
    const latest = allVersions[0]?.version;
    const facts = [
      ...(plugin.author ? [{ key: 'author', label: AdminI18n.t('plugins.list.developer'), value: String(plugin.author) }] : []),
      { key: 'version', label: AdminI18n.t('plugins.detail.version'), value: `v${selectedVersion || plugin.version}${selectedVersion === latest ? ` ${AdminI18n.t('plugins.list.latest')}` : ''}` },
      ...(plugin.homepage ? [{ key: 'homepage', label: 'Web', value: String(plugin.homepage) }] : []),
    ];
    return (
      <RecordCard title={plugin.name} aside={<Badge variant={installedPlugin ? BadgeVariant.SUCCESS : BadgeVariant.DEFAULT}>{plugin.category || AdminI18n.t('plugins.list.general')}</Badge>}>
        <div className="fc-stack">
          <Text size="base">{plugin.description}</Text>
          <AdminFactGrid facts={facts as any} />
          {allVersions.length > 1 ? (
            <div className="fc-form-grid">
              <Select label={AdminI18n.t('plugins.detail.version')} value={selectedVersion} onChange={onSelectVersion}
                options={allVersions.map((v) => ({ value: v.version, label: `v${v.version}${v.version === latest ? ` ${AdminI18n.t('plugins.list.latest')}` : ''}` }))} />
            </div>
          ) : null}
        </div>
      </RecordCard>
    );
  }
}
