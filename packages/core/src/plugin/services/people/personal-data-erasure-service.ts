import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import type { IPersonalDataDataset, IPersonalDataErasure, IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data.interface';

/**
 * Erasure and export for the data the FRAMEWORK holds about a person.
 *
 * This lives in core because it structurally cannot live anywhere else: `users`, `people`,
 * `_system_sessions`, `_system_users_roles`, `_system_tenant_memberships`, `_system_record_versions`
 * and the two journals are system tables, and a plugin reaching into one bypasses access control.
 * The privacy plugin orchestrates DSARs and reports on them; it must not — and now need not — know
 * any of these table names.
 *
 * THE ACCOUNT IS GLOBAL; EVERYTHING ELSE IS NOT. `users` has no `tenant_id` and row-level security
 * is off on it, so ONE account can administer several sites (measured: 2 of 30 on the dev box).
 * A site-level erasure therefore removes everything belonging to THIS site — the person record, its
 * addresses and relationships, sessions, roles, this site's membership — and only tombstones the
 * shared account when this was the subject's LAST membership. A request to one site must never
 * destroy a login for sites whose operators never received it and who are separate controllers.
 *
 * THE JOURNALS ARE ANONYMISED, NOT DELETED, and must be reached inside `withPlatformAdmin`: they sit
 * under the journal RLS policy, where an untenanted, unmarked write silently narrows to
 * `tenant_id IS NULL` rows — the same trap documented on `JournalRetentionService`.
 */
export class PersonalDataErasureService {
  /** What replaces an identifier. Recognisable as a tombstone, and not mistakable for a real value. */
  static readonly TOMBSTONE = '[erased]';

  private static readonly DELETE = 'delete';
  private static readonly ANONYMISE = 'anonymise';
  private static readonly RETAIN = 'retain';

  constructor(private readonly db: any) {}

  /**
   * The datasets the framework holds, as DESCRIPTORS the privacy plugin can register.
   *
   * Each declares only the strategies it can honestly honour. `audit-log` offers no `delete`: it is
   * the security record and this platform's EU AI Act Art. 12 store, and a row removed from it is
   * evidence destroyed. `sessions` offers no `anonymise`: an anonymised session is still a live
   * credential.
   */
  listDatasets(): IPersonalDataDataset[] {
    return [
      { key: 'account', label: 'Platform account', fields: ['email', 'username', 'firstName', 'lastName'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
      { key: 'person', label: 'Person record, addresses and relationships', fields: ['email', 'phone', 'firstName', 'lastName', 'address'],
        strategies: [PersonalDataErasureService.DELETE, PersonalDataErasureService.ANONYMISE],
        defaultStrategy: PersonalDataErasureService.DELETE },
      { key: 'sessions', label: 'Sign-in sessions', fields: ['ipAddress', 'userAgent'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: 'roles', label: 'Site membership and roles', fields: ['roles'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: 'record-versions', label: 'Edit history of the subject\'s own records', fields: ['versionData'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: 'audit-log', label: 'Audit trail', fields: ['metadata.userId', 'metadata.email', 'metadata.ip'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
      { key: 'system-log', label: 'System log', fields: ['context.userId', 'context.email', 'context.ip', 'message'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
    ];
  }

  async exportDataset(key: string, subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    switch (key) {
      case 'account': return this.rows(await this.findUser(subject));
      case 'person': return [
        ...this.rows(await this.findPerson(subject)),
        ...(await this.findAddresses(subject)),
      ];
      case 'sessions': return this.byUser(SystemConstants.TABLE.SESSIONS, subject);
      case 'roles': return this.byUser(SystemConstants.TABLE.TENANT_MEMBERSHIPS, subject);
      case 'record-versions': return this.findVersions(subject);
      case 'audit-log':
      case 'system-log':
        // The journals are exported as COUNTS, not rows. They carry other people's actions in the
        // same table and an unfiltered dump would be a disclosure, not a portability copy.
        return [{ dataset: key, rows: await this.countJournal(key, subject) }];
      default: return [];
    }
  }

  async eraseDataset(key: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    if (strategy === PersonalDataErasureService.RETAIN) {
      return PersonalDataErasureService.empty(strategy);
    }

    switch (key) {
      case 'account': return this.eraseAccount(subject, strategy);
      case 'person': return this.erasePerson(subject, strategy);
      case 'sessions': return this.deleteBy(SystemConstants.TABLE.SESSIONS, subject, strategy);
      case 'roles': return this.eraseMembership(subject, strategy);
      case 'record-versions': return this.eraseVersions(subject, strategy);
      case 'audit-log': return this.anonymiseJournal('audit-log', subject, strategy);
      case 'system-log': return this.anonymiseJournal('system-log', subject, strategy);
      default: return { ...PersonalDataErasureService.empty(strategy), remaining: 0 };
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
  private async eraseAccount(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const user = await this.findUser(subject);
    if (!user) return PersonalDataErasureService.empty(strategy);

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

  private async erasePerson(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const person = await this.findPerson(subject);
    if (!person) return PersonalDataErasureService.empty(strategy);

    const addresses = await this.findAddresses(subject);
    for (const address of addresses) {
      await this.db.delete(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: (address as any).id });
    }
    await this.db.delete(SystemConstants.TABLE.PERSON_RELATIONSHIPS, { from_person_id: person.id }).catch(() => undefined);

    if (strategy === PersonalDataErasureService.ANONYMISE) {
      await this.db.update(SystemConstants.TABLE.PEOPLE, { id: person.id }, {
        email: null, phone: null, firstName: PersonalDataErasureService.TOMBSTONE, lastName: null,
      });
      return { strategy, erased: addresses.length, anonymised: 1, retained: 0, remaining: 0 };
    }

    await this.db.delete(SystemConstants.TABLE.PEOPLE, { id: person.id });
    return { strategy, erased: addresses.length + 1, anonymised: 0, retained: 0, remaining: 0 };
  }

  /** This site's membership and roles only — never another site's. */
  private async eraseMembership(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataErasureService.userIdOf(subject);
    if (!userId) return PersonalDataErasureService.empty(strategy);

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
  private async eraseVersions(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const versions = await this.findVersions(subject);
    for (const version of versions) {
      await this.db.delete(SystemConstants.TABLE.RECORD_VERSIONS, { id: (version as any).id });
    }
    return { strategy, erased: versions.length, anonymised: 0, retained: 0, remaining: 0 };
  }

  /**
   * Strip the identifiers, keep the record.
   *
   * An audit row's value is `action`/`resource`/`status` — what was attempted and whether it was
   * allowed. That survives; the `userId`/`email`/`ip` inside the metadata do not. Deleting the row
   * would destroy the security record and this platform's Art. 12 evidence along with the personal
   * data, which is not what erasure asks for.
   */
  private async anonymiseJournal(key: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const isAudit = key === 'audit-log';
    const table = isAudit ? SystemConstants.TABLE.AUDIT_LOGS : SystemConstants.TABLE.LOGS;
    const blob = isAudit ? 'metadata' : 'context';

    // Platform marker, or the UPDATE silently narrows to `tenant_id IS NULL` rows and every site's
    // journal keeps the identifiers this is supposed to remove.
    return await this.db.withPlatformAdmin(async () => {
      const rows: any[] = await this.matchJournalRows(table, blob, subject);
      for (const row of rows) {
        const scrubbed = PersonalDataErasureService.scrub(row?.[blob]);
        const patch: Record<string, unknown> = { [blob]: scrubbed };
        if (!isAudit) patch.message = PersonalDataErasureService.scrubText(String(row?.message ?? ''), subject);
        await this.db.update(table, { id: row.id }, patch);
      }
      return { strategy, erased: 0, anonymised: rows.length, retained: 0, remaining: 0 };
    });
  }

  private async matchJournalRows(table: string, blob: string, subject: IPersonalDataSubject): Promise<any[]> {
    const email = String(subject?.email ?? '').trim().toLowerCase();
    const userId = PersonalDataErasureService.userIdOf(subject);
    const rows: any[] = await this.db.find(table, { where: {} , limit: 0 }).catch(() => []);
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const bag = PersonalDataErasureService.asObject(row?.[blob]);
      const inBlob = (bag.email && String(bag.email).toLowerCase() === email)
        || (userId && bag.userId != null && String(bag.userId) === userId);
      const inMessage = table === SystemConstants.TABLE.LOGS && email
        && String(row?.message ?? '').toLowerCase().includes(email);
      return Boolean(inBlob || inMessage);
    });
  }

  private static scrub(blob: unknown): Record<string, unknown> {
    const bag = PersonalDataErasureService.asObject(blob);
    for (const field of ['userId', 'email', 'ip', 'ipAddress', 'userAgent']) {
      if (field in bag) bag[field] = PersonalDataErasureService.TOMBSTONE;
    }
    return bag;
  }

  private static scrubText(message: string, subject: IPersonalDataSubject): string {
    const email = String(subject?.email ?? '').trim();
    if (!email) return message;
    return message.split(email).join(PersonalDataErasureService.TOMBSTONE);
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

  private async countJournal(key: string, subject: IPersonalDataSubject): Promise<number> {
    const table = key === 'audit-log' ? SystemConstants.TABLE.AUDIT_LOGS : SystemConstants.TABLE.LOGS;
    const blob = key === 'audit-log' ? 'metadata' : 'context';
    return await this.db.withPlatformAdmin(async () => (await this.matchJournalRows(table, blob, subject)).length);
  }

  private async deleteBy(table: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataErasureService.userIdOf(subject);
    if (!userId) return PersonalDataErasureService.empty(strategy);
    const rows: any[] = await this.db.find(table, { where: { user_id: userId } });
    for (const row of rows) await this.db.delete(table, { id: row.id });
    return { strategy, erased: rows.length, anonymised: 0, retained: 0, remaining: 0 };
  }

  private async findUser(subject: IPersonalDataSubject): Promise<Record<string, any> | null> {
    const userId = PersonalDataErasureService.userIdOf(subject);
    if (userId) return this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    const email = String(subject?.email ?? '').trim().toLowerCase();
    return email ? this.db.findOne(SystemConstants.TABLE.USERS, { email }) : null;
  }

  private async findPerson(subject: IPersonalDataSubject): Promise<Record<string, any> | null> {
    if (subject?.personId != null) return this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: subject.personId });
    const email = String(subject?.email ?? '').trim().toLowerCase();
    return email ? this.db.findOne(SystemConstants.TABLE.PEOPLE, { email }) : null;
  }

  private async findAddresses(subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const person = await this.findPerson(subject);
    if (!person) return [];
    return this.db.find(SystemConstants.TABLE.PEOPLE_ADDRESSES, { where: { person_id: person.id } });
  }

  private async findVersions(subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
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

  private async byUser(table: string, subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const userId = PersonalDataErasureService.userIdOf(subject);
    return userId ? this.db.find(table, { where: { user_id: userId } }) : [];
  }

  private rows(row: Record<string, any> | null): Record<string, unknown>[] {
    return row ? [row] : [];
  }

  private static userIdOf(subject: IPersonalDataSubject): string {
    return subject?.userId == null ? '' : String(subject.userId);
  }

  private static empty(strategy: string): IPersonalDataErasure {
    return { strategy, erased: 0, anonymised: 0, retained: 0, remaining: 0 };
  }
}
