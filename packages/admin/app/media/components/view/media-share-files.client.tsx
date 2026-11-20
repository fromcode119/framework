import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
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
      return <FrameworkIcons.File size={12} />;
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
        onError={() => this.patch({ failed: { ...this.failed, [Number(file.id)]: true } })}
      />
    );
  }

  render(): ReactNode {
    const files: any[] = Array.isArray(this.files) ? this.files : [];
    if (!files.length) return null;

    return (
      <div className="fc-chip-row">
        {files.map((file: any) => (
          <span key={file.id} className="fc-file-chip" title={file.name}>
            <span className="fc-file-chip__picture">{this.renderThumbnail(file)}</span>
            <span className="fc-file-chip__name">{file.name}</span>
          </span>
        ))}
      </div>
    );
  }
}
