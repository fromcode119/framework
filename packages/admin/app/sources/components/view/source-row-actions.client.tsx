import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Download, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/view/button.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { SourcesApi } from '@/app/sources/sources-api';
import type { SourceRow } from '@/app/sources/source-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A row's actions: Build in reach, everything else in the menu. Remove sat next to Build on every
 * row; in the menu it is two deliberate clicks away and the page still asks before removing.
 */
export class SourceRowActions extends PureReactor {
  declare props: Pick<SourceRowActions, 'row' | 'building' | 'onBuild' | 'onEdit' | 'onRemove'>;

  @prop declare row: SourceRow;
  /** This row's build was just requested and has not answered yet. */
  @prop declare building: boolean;
  @prop declare onBuild: (row: SourceRow) => void;
  @prop declare onEdit: (row: SourceRow) => void;
  @prop declare onRemove: (row: SourceRow) => void;

  @state downloading = false;

  /** The row opens on click; a press on its actions must not also open or close it. */
  @bound private stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  @bound private build(): void {
    this.onBuild(this.row);
  }

  @bound private edit(): void {
    this.onEdit(this.row);
  }

  @bound private remove(): void {
    this.onRemove(this.row);
  }

  /**
   * Fetches the package through the authenticated client and hands the browser the bytes. The archive
   * is made when asked for, so the first press can take a moment.
   */
  @bound private async download(): Promise<void> {
    if (!Platform.hasWindow || this.downloading) return;
    this.downloading = true;
    try {
      const { blob, filename } = await SourcesApi.downloadPackage(this.row.type, this.row.slug);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } finally {
      this.downloading = false;
    }
  }

  /** Offered once a build succeeded: a build stages a package directory, the archive is made on request. */
  private get canDownload(): boolean {
    return Boolean(this.row.version) && this.row.status === 'success';
  }

  private get items(): IDropdownItem[] {
    const items: IDropdownItem[] = [];
    if (this.canDownload) {
      items.push({ label: this.downloading ? AdminI18n.t('sources.packaging') : AdminI18n.t('sources.downloadPackage'), icon: <Download size={16} />, onClick: this.download });
    }
    items.push({ label: AdminI18n.t('sources.edit'), icon: <Pencil size={16} />, onClick: this.edit });
    items.push({ label: AdminI18n.t('sources.remove'), icon: <Trash2 size={16} />, variant: DropdownItemVariant.DANGER, onClick: this.remove });
    return items;
  }

  render(): ReactNode {
    return (
      <div className="flex items-center justify-end gap-1" onClick={this.stop}>
        <Button
          size={FieldSize.SM}
          variant={ButtonVariant.OUTLINE}
          disabled={this.building}
          onClick={this.build}
          icon={<Play size={12} className={this.building ? 'animate-spin' : ''} />}
        >
          {this.building ? AdminI18n.t('sources.building') : AdminI18n.t('sources.build')}
        </Button>
        <Dropdown
          trigger={(
            <button type="button" aria-label={AdminI18n.t('sources.moreActions')} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-white">
              <FrameworkIcons.MoreVertical size={16} />
            </button>
          )}
          items={this.items}
        />
      </div>
    );
  }
}
