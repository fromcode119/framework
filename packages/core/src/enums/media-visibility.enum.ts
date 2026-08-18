import { Enum } from '@fromcode119/reactor';

/**
 * Whether a media file is served by the public static mount or only through a gated route.
 *
 *   - `PUBLIC`  — lives in the uploads tree, has a permanent URL, served by `express.static`
 *   - `PRIVATE` — lives outside that tree, has NO public URL, readable only through an
 *                 authorization-checked stream
 *
 * `resolve` defaults to `PUBLIC` on purpose, and that is not a fail-open choice: every row written
 * before this field existed is genuinely public — its bytes are already sitting under a static mount.
 * Reading a legacy row as PRIVATE would claim a protection the file does not have, which is the more
 * dangerous lie. What must never be inferred is the reverse: a file marked PRIVATE is only ever stored
 * privately, so this default can never downgrade one that was.
 *
 * A reactor `Enum`, not a plain TS `enum`: members are singletons, so `visibility === MediaVisibility.PRIVATE`
 * is an identity check. Comparing a member to a RAW string is always false — cross a string boundary
 * (a DB column, a multipart form field) via `.value`.
 */
export class MediaVisibility extends Enum {
  static readonly PUBLIC = new MediaVisibility('public');
  static readonly PRIVATE = new MediaVisibility('private');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; unknown and absent both read as PUBLIC (see the note above). */
  static resolve(value: unknown): MediaVisibility {
    if (value instanceof MediaVisibility) return value;
    const found = MediaVisibility.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as MediaVisibility | undefined) ?? MediaVisibility.PUBLIC;
  }

  get isPrivate(): boolean {
    return this === MediaVisibility.PRIVATE;
  }
}
