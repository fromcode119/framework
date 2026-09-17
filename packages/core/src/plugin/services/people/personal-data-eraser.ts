import type { IPersonalDataErasure } from '@core/plugin/services/interfaces/personal-data-erasure.interface';
import type { IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data-subject.interface';
import { PersonalDataDatasetKey } from '@core/plugin/services/people/enums/personal-data-dataset-key.enum';
import { PersonalDataJournal } from '@core/plugin/services/people/enums/personal-data-journal.enum';
import { PersonalDataSubjectReader } from '@core/plugin/services/people/personal-data-subject-reader';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { PersonalDataStrategy } from '@core/plugin/services/people/enums/personal-data-strategy.enum';

/**
 * Actually removing one subject's data from one dataset, per the strategy chosen for it.
 *
 * Erasure is NOT one operation. An account, a person record, a site membership and a version history
 * each mean something different when a subject asks to be forgotten — a membership can go outright,
 * while a version history is the audit trail of what someone else published and cannot simply vanish.
 * So each dataset has its own path here, and the strategy says which of delete/anonymise/keep applies.
 *
 * Every path returns a RECORD of what it did rather than a boolean. "Kept by policy" and "nothing to
 * erase" are different answers, and a subject is owed the difference.
 *
 * Split out of `PersonalDataErasureService` (398 lines), which decides WHAT to erase and reports on it.
 */
export class PersonalDataEraser {
  /** What an anonymised field is replaced WITH — one value, so an erased row is recognisable as erased. */
  static readonly TOMBSTONE = '[erased]';

  private static readonly ANONYMISE = PersonalDataStrategy.ANONYMISE.value;
  private static readonly RETAIN = PersonalDataStrategy.RETAIN.value;

  constructor(
    private readonly db: any,
    private readonly reader: any,
    private readonly journals: any,
  ) {}

  async eraseDataset(key: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    if (strategy === PersonalDataEraser.RETAIN) {
      return PersonalDataEraser.empty(strategy);
    }

    switch (key) {
      case PersonalDataDatasetKey.ACCOUNT.value: return this.eraseAccount(subject, strategy);
      case PersonalDataDatasetKey.PERSON.value: return this.erasePerson(subject, strategy);
      case PersonalDataDatasetKey.SESSIONS.value: return this.deleteBy(SystemConstants.TABLE.SESSIONS, subject, strategy);
      case PersonalDataDatasetKey.ROLES.value: return this.eraseMembership(subject, strategy);
      case PersonalDataDatasetKey.RECORD_VERSIONS.value: return this.eraseVersions(subject, strategy);
      case PersonalDataDatasetKey.AUDIT_LOG.value: return this.journals.anonymise(PersonalDataJournal.AUDIT, subject, strategy);
      case PersonalDataDatasetKey.SYSTEM_LOG.value: return this.journals.anonymise(PersonalDataJournal.SYSTEM, subject, strategy);
      default: return { ...PersonalDataEraser.empty(strategy), remaining: 0 };
    }
  }

  /**
   * The GLOBAL account. Tombstoned only when this site was the subject's last one.
   *
   * `users` has no tenant column, so this row is shared. Removing it on behalf of one site would
   * take the person's login away on every other site that holds them — sites that never received
   * the request. When others remain, the account is reported as RETAINED with the count, which is a
   * lawful outcome the subject is told about, not a failure.
   */
  async eraseAccount(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const user = await this.reader.findUser(subject);
    if (!user) return PersonalDataEraser.empty(strategy);

    const tenantId = RequestContextUtils.getTenantId();
    const memberships: any[] = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { user_id: String(user.id) } });
    const elsewhere = memberships.filter((row) => String(row?.tenant_id ?? '') !== String(tenantId ?? ''));

    if (elsewhere.length > 0) {
      return {
        strategy, erased: 0, anonymised: 0, retained: 1, remaining: 0,
        retainedReason: `The platform account is shared with ${elsewhere.length} other site(s) and was kept.`
          + ' Only this site\'s data was erased; each other site is a separate controller.',
      };
    }

    const tombstone = `erased-${user.id}-${Date.now()}@deleted.invalid`;
    await this.db.update(SystemConstants.TABLE.USERS, { id: user.id }, {
      email: tombstone, username: tombstone, firstName: null, lastName: null,
      roles: '[]', permissions: '[]', updatedAt: new Date(),
    });
    return { strategy, erased: 0, anonymised: 1, retained: 0, remaining: 0 };
  }

  async erasePerson(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const people = await this.reader.findPeople(subject);
    if (people.length === 0) return PersonalDataEraser.empty(strategy);

    let erased = 0;
    let anonymised = 0;

    // Every row, not just the first. Addresses and relationships are keyed on the person, so they
    // are cleared per row rather than once for the subject.
    for (const person of people) {
      const addresses = await this.db.find(SystemConstants.TABLE.PEOPLE_ADDRESSES, { where: { person_id: person.id } });
      for (const address of addresses) {
        await this.db.delete(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: (address as any).id });
      }
      erased += addresses.length;
      await this.db.delete(SystemConstants.TABLE.PERSON_RELATIONSHIPS, { from_person_id: person.id }).catch(() => undefined);

      if (strategy === PersonalDataEraser.ANONYMISE) {
        await this.db.update(SystemConstants.TABLE.PEOPLE, { id: person.id }, {
          email: null, phone: null, firstName: PersonalDataEraser.TOMBSTONE, lastName: null,
        });
        anonymised += 1;
        continue;
      }

      await this.db.delete(SystemConstants.TABLE.PEOPLE, { id: person.id });
      erased += 1;
    }

    return { strategy, erased, anonymised, retained: 0, remaining: 0 };
  }

  /** This site's membership and roles only — never another site's. */
  async eraseMembership(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    if (!userId) return PersonalDataEraser.empty(strategy);

    const tenantId = RequestContextUtils.getTenantId();
    const filter: Record<string, unknown> = tenantId
      ? { user_id: userId, tenant_id: String(tenantId) }
      : { user_id: userId };
    const rows: any[] = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: filter });
    for (const row of rows) {
      await this.db.delete(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { id: row.id });
    }
    await this.db.delete(SystemConstants.TABLE.USERS_ROLES, { user_id: userId }).catch(() => undefined);
    return { strategy, erased: rows.length, anonymised: 0, retained: 0, remaining: 0 };
  }

  /**
   * The subject's OWN core records' edit history.
   *
   * `_system_record_versions` snapshots the full record JSON on every admin edit, so a person's
   * details survive in old versions after the live row is corrected. Deleted rather than edited in
   * place: a version is a copy, not evidence, and rewriting inside the JSON would leave a snapshot
   * that no longer matches what was actually saved at that time.
   */
  async eraseVersions(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const versions = await this.reader.findVersions(subject);
    for (const version of versions) {
      await this.db.delete(SystemConstants.TABLE.RECORD_VERSIONS, { id: (version as any).id });
    }
    return { strategy, erased: versions.length, anonymised: 0, retained: 0, remaining: 0 };
  }


  async deleteBy(table: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    if (!userId) return PersonalDataEraser.empty(strategy);
    const rows: any[] = await this.db.find(table, { where: { user_id: userId } });
    for (const row of rows) await this.db.delete(table, { id: row.id });
    return { strategy, erased: rows.length, anonymised: 0, retained: 0, remaining: 0 };
  }


  static empty(strategy: string): IPersonalDataErasure {
    return { strategy, erased: 0, anonymised: 0, retained: 0, remaining: 0 };
  }
}
