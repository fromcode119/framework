import { PersonalDataJournal } from '@core/plugin/services/people/enums/personal-data-journal.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { PersonalDataSubjectReader } from '@core/plugin/services/people/personal-data-subject-reader';
import type { IPersonalDataErasure } from '@core/plugin/services/interfaces/personal-data-erasure.interface';
import type { IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data-subject.interface';

/**
 * The two JOURNALS — the audit trail and the system log — and why they are a case of their own.
 *
 * They are anonymised, never deleted: a row removed from the audit trail is the security record and
 * this platform's Art. 12 evidence destroyed alongside the personal data, which is not what erasure
 * asks for. And they are the only tables where one row can carry several people, so they are matched
 * by scanning rather than by a foreign key.
 *
 * Split out of `PersonalDataErasureService` with its own scoping rule, because that rule is subtle
 * enough to be worth reading on its own — see `anonymise`.
 */
export class PersonalDataJournalService {
  /** What replaces an identifier. Recognisable as a tombstone, never mistakable for a real value. */
  static readonly TOMBSTONE = '[erased]';

  constructor(private readonly db: any) {}

  /**
   * Strip the identifiers, keep the record.
   *
   * An audit row's value is `action`/`resource`/`status` — what was attempted and whether it was
   * allowed. That survives; the `userId`/`email`/`ip` inside the metadata do not. Deleting the row
   * would destroy the security record and this platform's Art. 12 evidence along with the personal
   * data, which is not what erasure asks for.
   */
  async anonymise(journal: PersonalDataJournal, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const { table, blob, isAudit } = journal;

    const scrubRows = async (): Promise<IPersonalDataErasure> => {
      const rows: any[] = await this.matchRows(journal, subject);
      for (const row of rows) {
        const scrubbed = PersonalDataJournalService.scrub(row?.[blob]);
        const patch: Record<string, unknown> = { [blob]: scrubbed };
        if (!isAudit) patch.message = PersonalDataJournalService.scrubText(String(row?.message ?? ''), subject);
        await this.db.update(table, { id: row.id }, patch);
      }
      return { strategy, erased: 0, anonymised: rows.length, retained: 0, remaining: 0 };
    };

    // INSIDE A REQUEST, stay in the site's own scope. The journal policy admits a platform-admin
    // connection to READ every tenant's rows but its WITH CHECK has no platform clause at all, so
    // that connection can only write rows with `tenant_id IS NULL`: scrubbing a site's journal under
    // the marker selected the rows, tried to update them, and the whole erasure died with
    // "new row violates row-level security policy". Every self-delete by anyone who had ever signed
    // in failed that way, because signing in is what puts your address in the log.
    //
    // The site's own scope is also the RIGHT scope, not merely the one that works: a DSAR is made to
    // one controller about one site, and reading under the marker was pulling back other sites'
    // journal rows for the same person — rows that request was never about.
    //
    // With no tenant there is no site to scope to, and the marker is what reaches the PLATFORM's own
    // rows (`tenant_id IS NULL`), which that same WITH CHECK does allow.
    if (RequestContextUtils.getTenantId()) return scrubRows();
    return await this.db.withPlatformAdmin(scrubRows);
  }

  private async matchRows(journal: PersonalDataJournal, subject: IPersonalDataSubject): Promise<any[]> {
    const { table, blob } = journal;
    const email = String(subject?.email ?? '').trim().toLowerCase();
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    const rows: any[] = await this.db.find(table, { where: {} , limit: 0 }).catch(() => []);
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const bag = PersonalDataJournalService.asObject(row?.[blob]);
      const inBlob = (bag.email && String(bag.email).toLowerCase() === email)
        || (userId && bag.userId != null && String(bag.userId) === userId);
      // Only the system log puts identifiers in its `message`; an audit row's message is the action.
      const inMessage = !journal.isAudit && email
        && String(row?.message ?? '').toLowerCase().includes(email);
      return Boolean(inBlob || inMessage);
    });
  }

  private static scrub(blob: unknown): Record<string, unknown> {
    const bag = PersonalDataJournalService.asObject(blob);
    for (const field of ['userId', 'email', 'ip', 'ipAddress', 'userAgent']) {
      if (field in bag) bag[field] = PersonalDataJournalService.TOMBSTONE;
    }
    return bag;
  }

  private static scrubText(message: string, subject: IPersonalDataSubject): string {
    const email = String(subject?.email ?? '').trim();
    if (!email) return message;
    return message.split(email).join(PersonalDataJournalService.TOMBSTONE);
  }

  private static asObject(blob: unknown): Record<string, any> {
    if (blob && typeof blob === 'object') return { ...(blob as Record<string, any>) };
    try {
      const parsed = JSON.parse(String(blob ?? '{}'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Counted in the SAME scope the scrub runs in, or the number is about rows the scrub will never
   * reach.
   *
   * The export reports this count and an erasure acts on `anonymise`'s rows. Under the platform
   * marker the count spans every site — the marker is admitted for reading, which is why this never
   * failed the way the write did — so a request about site A reported that person's journal rows
   * across the whole deployment, and the figure could never fall to zero no matter how many times
   * the erasure ran. Two numbers describing two different sets, one of them presented to a data
   * subject as the answer about their data.
   */
  async count(journal: PersonalDataJournal, subject: IPersonalDataSubject): Promise<number> {
    const rows = async (): Promise<number> => (await this.matchRows(journal, subject)).length;
    if (RequestContextUtils.getTenantId()) return rows();
    return await this.db.withPlatformAdmin(rows);
  }
}
