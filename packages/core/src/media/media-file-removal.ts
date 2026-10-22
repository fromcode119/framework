import { MediaVisibility } from '@core/enums/media-visibility.enum';

/**
 * Removes a media row's bytes from the space they live in — the original and its webp variant.
 *
 * The space is the row's visibility. Removing without it asked the PUBLIC driver for a private file,
 * which threw ENOENT: the admin's delete answered 500 and left both the private file and its row in
 * place. One helper so the admin route and `context.media.remove` cannot disagree on where a file is.
 *
 * A file already gone is not an error — the caller is deleting it, and the row must still go.
 */
export class MediaFileRemoval {
  static async removeBytes(
    storage: { remove(filepath: string, space?: string): Promise<void> },
    row: { path?: unknown; optimizedPath?: unknown; visibility?: unknown },
  ): Promise<void> {
    const space = MediaVisibility.resolve(row.visibility).value;
    const original = String(row.path ?? '');
    if (original) await MediaFileRemoval.removeQuietly(storage, original, space);
    // The webp variant is always written to the public space (private files never get one).
    const variant = String(row.optimizedPath ?? '');
    if (variant) await MediaFileRemoval.removeQuietly(storage, variant, MediaVisibility.PUBLIC.value);
  }

  private static async removeQuietly(storage: { remove(filepath: string, space?: string): Promise<void> }, filepath: string, space: string): Promise<void> {
    try {
      await storage.remove(filepath, space);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}
