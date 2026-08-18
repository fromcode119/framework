import type { IAccountFileGroup } from '@react/account/interfaces/account-file-group.interface';
import type { IAccountFileSourceContext } from '@react/account/interfaces/account-file-source-context.interface';

/**
 * A contributor of downloadable files to the account area.
 *
 * The account used to grow a panel per owner — one plugin's "Materials", another's "Downloads", framework
 * "Shared files" — so a person hunting for one file had three places to look and no way to know which.
 * A source contributes its files to ONE panel instead.
 *
 * The members are STATIC on the contributing class, because the slot carries classes rather than
 * instances — the registry never constructs anything it is handed. This interface described instance
 * members once, and the mismatch was silent: the framework's own source satisfied the interface, failed
 * the registry's actual check, and contributed nothing while the endpoint behind it worked perfectly.
 *
 * The framework names no plugin — a source exists because a plugin registered one, and vanishes with it.
 */
export interface IAccountFileSource {
  /**
   * Identity and presentation. `key` is a stable React key and the tiebreak for ordering; `priority`
   * sorts (lower first); `labelKey` is a TRANSLATION key resolved by the panel, never finished copy —
   * the framework holds no copy for someone else's domain.
   */
  readonly fileSource: { key: string; priority?: number; labelKey?: string };

  /**
   * Load this source's groups for the signed-in user.
   *
   * Receives the plugin api AND a translator: any copy a source produces (a badge, a subtitle) is
   * user-facing, so it must come from the owner's locale files rather than a literal in a `.ts`.
   *
   * MUST resolve to `[]` rather than throwing when the user simply has nothing here — the panel cannot
   * tell an empty source from a broken one, and a thrown error would blank the whole list including
   * other sources' files.
   */
  loadFiles(context: IAccountFileSourceContext): Promise<IAccountFileGroup[]>;
}
