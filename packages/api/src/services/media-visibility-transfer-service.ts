import { Logger, MediaVisibility } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';

/**
 * Moves a stored file between storage spaces when its visibility changes.
 *
 * Flipping the `visibility` column alone would be a corruption, not a change: the row would claim the
 * file is private while its bytes stay in the statically-served tree (still fetchable by anyone with
 * the URL), or claim it is public while the reader looks in a directory that has no such file. The
 * column and the bytes have to move together.
 *
 * Order is chosen so no failure loses the file:
 *   1. read from the current space and write to the target — the file now exists in BOTH
 *   2. caller updates the row
 *   3. delete the original
 *
 * A crash after (1) leaves a harmless orphan. A crash after (2) leaves a duplicate whose row is still
 * correct. Deleting first would risk a row pointing at nothing.
 */
export class MediaVisibilityTransferService {
  private readonly logger = new Logger({ namespace: 'media-visibility-transfer' });

  constructor(private readonly mediaManager: MediaManager) {}

  /**
   * Copies the file into the target space and returns its new stored path.
   *
   * Throws when the target space does not exist, rather than silently leaving the file where it is —
   * an operator who marks something private must not be told it worked when it did not.
   */
  async copyToSpace(currentPath: string, from: MediaVisibility, to: MediaVisibility, filename: string): Promise<string> {
    if (from === to) return currentPath;

    const stream = await this.mediaManager.stream(currentPath, from.value);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));

    // Through `upload` rather than the driver directly, so the target space's own validation and
    // naming apply — a moved file is stored exactly as a freshly uploaded one would be.
    const result = await this.mediaManager.upload(Buffer.concat(chunks), filename, { space: to.value });
    return result.path;
  }

  /**
   * Removes the file from the space it came from. Failure is logged, never thrown: by the time this
   * runs the row already points at the new copy, so the move has succeeded and an undeleted original
   * is a cleanup problem, not a correctness one.
   *
   * It is still worth logging loudly when the leftover is in the PUBLIC tree — that copy is reachable
   * by URL, so a stale one is exactly the exposure the move was meant to end.
   */
  async removeFromSpace(path: string, space: MediaVisibility): Promise<void> {
    try {
      await this.mediaManager.remove(path, space.value);
    } catch (error: any) {
      const severity = space.isPrivate ? 'orphaned private copy' : 'PUBLICLY READABLE leftover copy';
      this.logger.error(`Could not remove ${severity} at ${path}: ${error?.message || error}`);
    }
  }
}
