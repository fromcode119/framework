import { SystemConstants } from '@core/constants/system.constants';
import type { IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data-subject.interface';

/**
 * Finding every row a subject owns, across the tables the framework holds them in.
 *
 * Split out of `PersonalDataErasureService` because they answer a different question: that class
 * decides WHAT to do with a person's data, these decide WHICH rows are theirs. Keeping them together
 * put the policy, the strategies, the journals and the row lookups in one 500-line file.
 *
 * Read-only by construction. Nothing here writes, so an erasure and an export can share it without
 * an export ever being able to change something.
 */
export class PersonalDataSubjectReader {
  constructor(private readonly db: any) {}

  async findUser(subject: IPersonalDataSubject): Promise<Record<string, any> | null> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    if (userId) return this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    const email = String(subject?.email ?? '').trim().toLowerCase();
    return email ? this.db.findOne(SystemConstants.TABLE.USERS, { email }) : null;
  }

  /**
   * EVERY person row for this subject, not the first one the database happens to return.
   *
   * A subject routinely has more than one: the row linked to their account, plus unlinked rows a
   * plugin's `people.syncDirectory` created from its own table — an invoice customer, for instance,
   * lands as `source: finance` with no `user_id`. `findOne` erased whichever came back first and
   * left the rest, so an erasure reported as done left the subject's email sitting in `people`.
   * Which row survived was effectively chance, which is not a defensible outcome under any reading
   * of a retention obligation: the statutory document is the INVOICE, and a directory row derived
   * from it is not that document.
   */
  async findPeople(subject: IPersonalDataSubject): Promise<Record<string, any>[]> {
    const email = String(subject?.email ?? '').trim().toLowerCase();
    const rows: Record<string, any>[] = email
      ? await this.db.find(SystemConstants.TABLE.PEOPLE, { where: { email } })
      : [];

    // The EMAIL leads, and `personId` only adds a row the email did not already reach.
    //
    // Resolving a subject sets `personId` from `people.getByEmail`, which returns ONE row. Treating
    // that id as the answer narrowed the erasure back to a single row and left every duplicate
    // behind — the exact bug this method exists to fix, reintroduced by trusting the more specific
    // identifier. A personId with no email is the only case where it stands alone.
    if (subject?.personId != null && !rows.some((row) => String(row?.id) === String(subject.personId))) {
      const byId = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: subject.personId });
      if (byId) rows.push(byId);
    }
    return rows;
  }

  async findPerson(subject: IPersonalDataSubject): Promise<Record<string, any> | null> {
    const [first] = await this.findPeople(subject);
    return first ?? null;
  }

  async findAddresses(subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const person = await this.findPerson(subject);
    if (!person) return [];
    return this.db.find(SystemConstants.TABLE.PEOPLE_ADDRESSES, { where: { person_id: person.id } });
  }

  async findVersions(subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const person = await this.findPerson(subject);
    const user = await this.findUser(subject);
    const out: Record<string, unknown>[] = [];
    for (const [collection, id] of [[SystemConstants.TABLE.PEOPLE, person?.id], [SystemConstants.TABLE.USERS, user?.id]] as const) {
      if (id == null) continue;
      const rows = await this.db.find(SystemConstants.TABLE.RECORD_VERSIONS, {
        where: { ref_collection: collection, ref_id: String(id) },
      });
      out.push(...(Array.isArray(rows) ? rows : []));
    }
    return out;
  }

  async byUser(table: string, subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    return userId ? this.db.find(table, { where: { user_id: userId } }) : [];
  }

  rows(row: Record<string, any> | null): Record<string, unknown>[] {
    return row ? [row] : [];
  }

  static userIdOf(subject: IPersonalDataSubject): string {
    return subject?.userId == null ? '' : String(subject.userId);
  }
}
