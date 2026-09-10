import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminServices } from '@/lib/admin-services';

/**
 * The files in a share — thumbnail and name. This is the content the row's old "2 files" hid.
 *
 * A shared file is private by definition, so its thumbnail comes from the admin-guarded raw route
 * rather than a public URL, which does not exist for it. The first version drew a lock instead, which
 * made every row in the list look identical — defeating the one thing the screen is for.
 */
export class MediaShareFiles extends AdminComponent {
  @prop declare files: any[];

  /**
   * Files whose bytes could not be loaded, so they fall back to the generic icon.
   *
   * A share outlives the file it points at — the media row can be deleted, or the bytes lost — and a
   * browser's broken-image glyph reads as a bug in the page rather than as a missing file.
   */
  @state private failed: Record<number, boolean> = {};

  private renderThumbnail(file: any): ReactNode {
    if (!String(file.mimeType || '').startsWith('image/') || this.failed[Number(file.id)]) {
      return <FrameworkIcons.File size={12} className="text-slate-400" />;
    }

    const src = AdminServices.getInstance().media.resolvePreviewUrl({
      id: file.id,
      url: file.url,
      visibility: file.isPrivate ? 'private' : 'public',
    });
    return (
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={() => this.patch({ failed: { ...this.failed, [Number(file.id)]: true } })}
      />
    );
  }

  render(): ReactNode {
    const files: any[] = Array.isArray(this.files) ? this.files : [];
    if (!files.length) return null;

    const dark = this.theme === ThemeMode.DARK;

    return (
      <div className="mt-2.5 flex flex-wrap gap-2">
        {files.map((file: any) => (
          <span
            key={file.id}
            className={`inline-flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 text-[11px] max-w-full ${
              dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
            }`}
            title={file.name}
          >
            <span className={`h-7 w-7 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0 ${
              dark ? 'bg-slate-900' : 'bg-white'
            }`}>
              {this.renderThumbnail(file)}
            </span>
            <span className="truncate">{file.name}</span>
          </span>
        ))}
      </div>
    );
  }
}
