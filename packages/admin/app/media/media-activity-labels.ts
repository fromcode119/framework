/**
 * Turns log values into words an operator can read.
 *
 * The whole reason this file exists: a row records an outcome (`granted`) plus a kind (`view` /
 * `download`), and rendering the outcome alone made a page refresh and a real download both say
 * "Opened". Twenty identical rows told you nothing about what anyone actually did.
 */
export class MediaActivityLabels {
  /** Why `unknown` is worth reading closely — it is the only refusal that suggests someone else. */
  static readonly REFUSAL_NOTE = 'Expired and limit-reached are routine. "Unknown link" means a token matching no grant — what guessing at URLs looks like.';

  private static readonly OUTCOMES: Record<string, string> = {
    granted: 'Opened',
    unknown: 'Unknown link',
    expired: 'Expired',
    revoked: 'Revoked',
    over_limit: 'Limit reached',
    account_required: 'Sign-in needed',
    confirmation_required: 'Confirmation needed',
  };

  static outcome(value: unknown): string {
    const key = String(value ?? '');
    return MediaActivityLabels.OUTCOMES[key] ?? key;
  }

  /**
   * What this row says happened, in one phrase.
   *
   * A refusal names its reason; a success names the ACT, because "granted" is not something a person
   * did. A download names its file — that is the difference the old label threw away.
   */
  static action(row: { kind?: unknown; outcome?: unknown; fileName?: unknown }): string {
    if (String(row?.outcome ?? '') !== 'granted') return MediaActivityLabels.outcome(row?.outcome);

    if (String(row?.kind ?? '') === 'download') {
      const name = String(row?.fileName ?? '').trim();
      return name ? `downloaded ${name}` : 'downloaded a file';
    }

    return 'opened the page';
  }
}
