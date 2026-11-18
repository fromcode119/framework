import type { IMediaFolder } from '@/components/ui/interfaces/media-folder.interface';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { DialogSize } from '@/components/ui/enums/dialog-size.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmptyState } from '@/components/ui/view/empty-state.client';
export class MoveDialog extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (targetFolderId: number | null) => void;
  @prop declare title?: string;
  @prop declare isLoading?: boolean;

  @state folders: IMediaFolder[] = [];
  @state currentParentId: number | null = null;
  @state loading = false;
  @state path: IMediaFolder[] = [];

  @bound private async fetchFolders(parentId: number | null): Promise<void> {
    this.loading = true;
    try {
      const pId = parentId === null ? 'null' : parentId;
      const data = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders?parentId=${pId}`);
      this.folders = data;

      if (parentId) {
        const pathData = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}/folders/${parentId}/path`);
        this.path = pathData;
      } else {
        this.path = [];
      }
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    } finally {
      this.loading = false;
    }
  }

  @bound private openFolder(parentId: number | null): void {
    this.currentParentId = parentId;
    void this.fetchFolders(parentId);
  }

  componentDidMount(): void {
    if (this.isOpen) this.openFolder(null);
  }

  componentDidUpdate(prevProps: { isOpen?: boolean }): void {
    if (!prevProps.isOpen && this.isOpen) this.openFolder(null);
  }

  private get foot(): ReactNode {
    const isLoading = this.isLoading ?? false;
    return (
      <>
        <Button variant={ButtonVariant.GHOST} onClick={this.onClose} disabled={isLoading}>
          {AdminI18n.t('common.cancel')}
        </Button>
        <Button onClick={() => this.onConfirm(this.currentParentId)} isLoading={isLoading} icon={<FrameworkIcons.Check size={16} />}>
          {AdminI18n.t('ui.move.confirm')}
        </Button>
      </>
    );
  }

  /** Where in the tree the chooser is: the root, then each folder opened from it. */
  private get crumbs(): ReactNode {
    return (
      <nav className="fc-move__path">
        <button
          type="button"
          onClick={() => this.openFolder(null)}
          className={`fc-move__crumb${this.currentParentId === null ? ' fc-move__crumb--current' : ''}`}
        >
          {AdminI18n.t('ui.move.root')}
        </button>
        {this.path.map((folder) => (
          <Fragment key={folder.id}>
            <span className="fc-move__sep">/</span>
            <button
              type="button"
              onClick={() => this.openFolder(folder.id)}
              className={`fc-move__crumb${this.currentParentId === folder.id ? ' fc-move__crumb--current' : ''}`}
            >
              {folder.name}
            </button>
          </Fragment>
        ))}
      </nav>
    );
  }

  render(): ReactNode {
    return (
      <Dialog
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={this.title ?? AdminI18n.t('ui.move.title')}
        icon={<FrameworkIcons.Folder size={18} />}
        size={DialogSize.SMALL}
        busy={this.isLoading ?? false}
        foot={this.foot}
      >
        {this.crumbs}
        <div className="fc-move__list">
          {this.loading
            ? <div className="fc-move__loading"><FrameworkIcons.Loader className="animate-spin" size={20} /></div>
            : this.folders.length === 0
              ? <EmptyState inline title={AdminI18n.t('ui.move.empty')} />
              : this.folders.map((folder) => (
                <button key={folder.id} type="button" onClick={() => this.openFolder(folder.id)} className="fc-move__folder">
                  <FrameworkIcons.Folder size={16} />
                  <span className="fc-move__name">{folder.name}</span>
                </button>
              ))}
        </div>
      </Dialog>
    );
  }
}
