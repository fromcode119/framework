import type { IMediaFolder } from '@/components/ui/interfaces/media-folder.interface';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { prop, state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
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

  render(): ReactNode {
    const { isOpen, onClose, onConfirm } = this;
    const title = this.title ?? 'Move to Folder';
    const isLoading = this.isLoading ?? false;
    const theme = this.theme;
    const { folders, currentParentId, loading, path } = this;

    if (!isOpen) return null;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" 
          onClick={onClose}
        />
        
        {/* Dialog */}
        <div className={`relative w-full max-w-md my-auto rounded-xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
        <div className="p-6">
          <h3 className={`text-xl font-bold ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h3>
          
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/10 mb-4">
            <button
              onClick={() => this.openFolder(null)}
              className={`text-[10px] font-semibold tracking-wide ${currentParentId === null ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Root
            </button>
            {path.map((folder) => (
              <Fragment key={folder.id}>
                <span className="text-slate-400 text-[10px]">/</span>
                <button
                  onClick={() => this.openFolder(folder.id)}
                  className={`text-[10px] font-semibold tracking-wide ${currentParentId === folder.id ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {folder.name}
                </button>
              </Fragment>
            ))}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 mb-6 min-h-[120px]">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <FrameworkIcons.Loader className="animate-spin text-indigo-500" size={24} />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-sm">
                <p>No subfolders found</p>
              </div>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => this.openFolder(folder.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    theme === ThemeMode.DARK 
                      ? 'hover:bg-slate-800 text-slate-300 hover:text-white' 
                      : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FrameworkIcons.Folder size={18} className="text-amber-500" />
                  <span className="flex-1 font-medium">{folder.name}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant={ButtonVariant.OUTLINE}
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 px-6 py-2.5 rounded-xl font-semibold tracking-wide text-[11px]"
              onClick={() => onConfirm(currentParentId)}
              isLoading={isLoading}
              icon={<FrameworkIcons.Check size={18} />}
            >
              Move Here
            </Button>
          </div>
        </div>
      </div>
    </div>
    </RootFramework>
    );
  }
}
