import { Enum } from '@fromcode119/react-class-components';

/**
 * What a logged access actually was: someone opening the share page, or fetching a file.
 *
 * The log stores an OUTCOME, and `granted` covers both — so a page refresh and a real download were
 * indistinguishable, and every row on the activity screen read "Opened". The distinction was already in
 * the data and simply unread: a page view carries no `media_id`, a download carries the file's.
 *
 * A reactor `Enum`, so `kind === FileAccessKind.DOWNLOAD` is an identity check. Comparing a member to a
 * raw string is always false — cross a string boundary via `.value`.
 */
export class FileAccessKind extends Enum {
  static readonly VIEW = new FileAccessKind('view');
  static readonly DOWNLOAD = new FileAccessKind('download');

  private constructor(value: string) {
    super(value);
  }

  /** Classifies a raw log row. Anything without a usable media id is a page view. */
  static of(row: { media_id?: unknown; mediaId?: unknown } | null | undefined): FileAccessKind {
    const raw = row?.media_id ?? row?.mediaId;
    if (raw === null || raw === undefined || raw === '') return FileAccessKind.VIEW;

    const mediaId = Number(raw);
    return Number.isFinite(mediaId) && mediaId > 0 ? FileAccessKind.DOWNLOAD : FileAccessKind.VIEW;
  }

  get isView(): boolean {
    return this === FileAccessKind.VIEW;
  }

  get isDownload(): boolean {
    return this === FileAccessKind.DOWNLOAD;
  }
}
