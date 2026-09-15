import { PersonalDataRegistry } from '@core/plugin/services/people/personal-data-registry';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { PersonalDataErasurePolicy } from '@core/plugin/services/people/personal-data-erasure-policy';
import { PersonalDataDatasetKey } from '@core/plugin/services/people/enums/personal-data-dataset-key.enum';
import { PersonalDataJournal } from '@core/plugin/services/people/enums/personal-data-journal.enum';
import { PersonalDataStrategy } from '@core/plugin/services/people/enums/personal-data-strategy.enum';
import { PersonalDataSubjectReader } from '@core/plugin/services/people/personal-data-subject-reader';
import { PersonalDataJournalService } from '@core/plugin/services/people/personal-data-journal-service';
import type { IPersonalDataDataset } from '@core/plugin/services/interfaces/personal-data-dataset.interface';
import type { IPersonalDataErasure } from '@core/plugin/services/interfaces/personal-data-erasure.interface';
import type { IPersonalDataErasureOutcome } from '@core/plugin/services/interfaces/personal-data-erasure-outcome.interface';
import type { IPersonalDataSubject } from '@core/plugin/services/interfaces/personal-data-subject.interface';
import type { IPersonalDataChoiceMap } from '@core/plugin/services/people/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataPolicyRow } from '@core/plugin/services/people/interfaces/personal-data-policy-row.interface';
import type { IPersonalDataPolicyTarget } from '@core/plugin/services/people/interfaces/personal-data-policy-target.interface';
import type { IPersonalDataStrategyChoice } from '@core/plugin/services/people/interfaces/personal-data-strategy-choice.interface';

/**
 * Erasure and export for the data the FRAMEWORK holds about a person.
 *
 * This lives in core because it structurally cannot live anywhere else: `users`, `people`,
 * `_system_sessions`, `_system_users_roles`, `_system_tenant_memberships`, `_system_record_versions`
 * and the two journals are system tables, and a plugin reaching into one bypasses access control.
 * A compliance plugin orchestrates DSARs and reports on them; it must not — and now need not — know
 * any of these table names.
 *
 * THE ACCOUNT IS GLOBAL; EVERYTHING ELSE IS NOT. `users` has no `tenant_id` and row-level security
 * is off on it, so ONE account can administer several sites (measured: 2 of 30 on the dev box).
 * A site-level erasure therefore removes everything belonging to THIS site — the person record, its
 * addresses and relationships, sessions, roles, this site's membership — and only tombstones the
 * shared account when this was the subject's LAST membership. A request to one site must never
 * destroy a login for sites whose operators never received it and who are separate controllers.
 *
 * THE JOURNALS ARE ANONYMISED, NOT DELETED, and WHICH SCOPE reaches them depends on whether there is
 * a site: inside a request the rows belong to that site and its own scope both finds and may write
 * them; with no site, `withPlatformAdmin` is what reaches the platform's own `tenant_id IS NULL` rows.
 * The marker is NOT the answer in both cases — the journal policy admits it for reading and omits it
 * from `WITH CHECK`, so a marked write of a site's row is refused outright. See
 * `PersonalDataJournalService.anonymise`, and `JournalRetentionService` for the mirror-image trap
 * where an unmarked untenanted prune reached only platform rows.
 */
export class PersonalDataErasureService {
  /** What replaces an identifier. Recognisable as a tombstone, and not mistakable for a real value. */
  static readonly TOMBSTONE = '[erased]';

  private static readonly DELETE = PersonalDataStrategy.DELETE.value;
  private static readonly ANONYMISE = PersonalDataStrategy.ANONYMISE.value;
  private static readonly RETAIN = PersonalDataStrategy.RETAIN.value;

  /** What the framework's own datasets are addressed as, wherever a policy is keyed `slug:dataset`. */
  private static readonly PLATFORM_SLUG = 'platform';

  /**
   * The shared account's entry in an `eraseAll` result.
   *
   * Named here because the self-delete endpoint reads exactly this one to decide what to tell the
   * subject — whether their login survived because another site still holds it — and a string spelled
   * at the call site would go stale silently the moment the id shape changed.
   */
  static readonly ACCOUNT_ID = `${PersonalDataErasureService.PLATFORM_SLUG}:account`;

  /** The strategy that KEEPS a dataset, named for callers that must distinguish kept from erased. */
  static readonly RETAIN_STRATEGY = PersonalDataStrategy.RETAIN.value;

  private readonly reader: PersonalDataSubjectReader;
  private readonly journals: PersonalDataJournalService;

  constructor(private readonly db: any) {
    this.reader = new PersonalDataSubjectReader(db);
    this.journals = new PersonalDataJournalService(db);
  }

  /**
   * The datasets the framework holds, as DESCRIPTORS a compliance plugin can report on.
   *
   * Each declares only the strategies it can honestly honour. `audit-log` offers no `delete`: it is
   * the security record and this platform's EU AI Act Art. 12 store, and a row removed from it is
   * evidence destroyed. `sessions` offers no `anonymise`: an anonymised session is still a live
   * credential.
   */
  listDatasets(): IPersonalDataDataset[] {
    return [
      { key: PersonalDataDatasetKey.ACCOUNT.value, label: 'Platform account', fields: ['email', 'username', 'firstName', 'lastName'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
      { key: PersonalDataDatasetKey.PERSON.value, label: 'Person record, addresses and relationships', fields: ['email', 'phone', 'firstName', 'lastName', 'address'],
        strategies: [PersonalDataErasureService.DELETE, PersonalDataErasureService.ANONYMISE],
        defaultStrategy: PersonalDataErasureService.DELETE },
      { key: PersonalDataDatasetKey.SESSIONS.value, label: 'Sign-in sessions', fields: ['ipAddress', 'userAgent'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: PersonalDataDatasetKey.ROLES.value, label: 'Site membership and roles', fields: ['roles'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: PersonalDataDatasetKey.RECORD_VERSIONS.value, label: 'Edit history of the subject\'s own records', fields: ['versionData'],
        strategies: [PersonalDataErasureService.DELETE], defaultStrategy: PersonalDataErasureService.DELETE },
      { key: PersonalDataDatasetKey.AUDIT_LOG.value, label: 'Audit trail', fields: ['metadata.userId', 'metadata.email', 'metadata.ip'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
      { key: PersonalDataDatasetKey.SYSTEM_LOG.value, label: 'System log', fields: ['context.userId', 'context.email', 'context.ip', 'message'],
        strategies: [PersonalDataErasureService.ANONYMISE, PersonalDataErasureService.RETAIN],
        defaultStrategy: PersonalDataErasureService.ANONYMISE },
    ];
  }

  async exportDataset(key: string, subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    switch (key) {
      case PersonalDataDatasetKey.ACCOUNT.value: return this.reader.rows(await this.reader.findUser(subject));
      case PersonalDataDatasetKey.PERSON.value: return [
        ...this.reader.rows(await this.reader.findPerson(subject)),
        ...(await this.reader.findAddresses(subject)),
      ];
      case PersonalDataDatasetKey.SESSIONS.value: return this.reader.byUser(SystemConstants.TABLE.SESSIONS, subject);
      case PersonalDataDatasetKey.ROLES.value: return this.reader.byUser(SystemConstants.TABLE.TENANT_MEMBERSHIPS, subject);
      case PersonalDataDatasetKey.RECORD_VERSIONS.value: return this.reader.findVersions(subject);
      case PersonalDataDatasetKey.AUDIT_LOG.value:
      case PersonalDataDatasetKey.SYSTEM_LOG.value: {
        // The journals are exported as COUNTS, not rows. They carry other people's actions in the
        // same table and an unfiltered dump would be a disclosure, not a portability copy.
        const journal = PersonalDataJournal.fromValue(key);
        return journal ? [{ dataset: key, rows: await this.journals.count(journal, subject) }] : [];
      }
      default: return [];
    }
  }

  /**
   * Everything held about the subject, across the framework's datasets AND every registered plugin
   * source — the counterpart to `eraseAll`, and for the same reason.
   *
   * Two doors lead to a subject's own data and they must not disagree. `exportMyData` hand-assembled
   * an account and a person record: two objects, while the same person asking through a DSAR got
   * sixteen datasets including their orders, invoices and submissions. A subject exercising Art. 15
   * from their account page was quietly told they held almost nothing.
   *
   * A source that fails is REPORTED as failed, never omitted: a silently short export reads to the
   * subject as "you hold nothing about me", which is the one thing an export must never imply.
   */
  async exportAll(subject: IPersonalDataSubject): Promise<Record<string, unknown>[]> {
    const datasets: Record<string, unknown>[] = [];

    for (const dataset of this.listDatasets()) {
      datasets.push({
        plugin: 'platform',
        dataset: dataset.key,
        label: dataset.label,
        personalDataFields: dataset.fields,
        records: await this.exportDataset(dataset.key, subject),
      });
    }

    for (const source of PersonalDataRegistry.listForCurrentTenant()) {
      const entry = { plugin: source.pluginSlug, dataset: source.key, label: source.label, personalDataFields: source.fields };
      try {
        datasets.push({ ...entry, records: await source.invoke.exportSubject(subject) });
      } catch (error: any) {
        datasets.push({ ...entry, error: String(error?.message ?? error) });
      }
    }

    return datasets;
  }

  /**
   * Erase EVERY dataset the framework holds, each with the strategy its own descriptor declares.
   *
   * This exists so the two doors into erasure cannot drift. A DSAR walks the registry and reaches
   * all seven; `deleteMyAccount` used to hand-list four, so a person who deleted their own account
   * kept their email and IP in the audit and system logs while the same person asking through a DSAR
   * had them anonymised. Same request, two outcomes, decided by which button they found.
   *
   * Iteration order is `listDatasets()` order, and that matters: `account` reads the memberships to
   * decide whether the login is shared with other sites, so it must run before `roles` removes them.
   *
   * A dataset added to `listDatasets()` is covered by both paths from that moment on, with no second
   * list to remember.
   */
  async eraseAll(
    subject: IPersonalDataSubject,
    options?: { overrides?: IPersonalDataChoiceMap; actor?: string },
  ): Promise<Record<string, IPersonalDataErasureOutcome>> {
    const policy = await PersonalDataErasurePolicy.load(this.db, options);
    const results: Record<string, IPersonalDataErasureOutcome> = {};

    // The framework's own datasets first, in `listDatasets()` order — `account` reads the memberships
    // that `roles` deletes, so it must run before them.
    for (const target of this.policyTargets()) {
      const choice = policy.resolve(target);
      results[choice.id] = {
        ...await this.eraseDataset(target.key, subject, choice.strategy),
        ...PersonalDataErasureService.decision(target, choice),
      };
    }

    // Then every dataset a PLUGIN declared. Walking these here is what makes an erasure complete on
    // a site with no compliance plugin installed at all: `deleteMyAccount` used to reach the seven above
    // and leave every order, invoice and submission untouched, with nothing reporting a gap.
    for (const source of PersonalDataRegistry.listForCurrentTenant()) {
      const choice = policy.resolve(source);
      const decision = PersonalDataErasureService.decision(source, choice);
      try {
        const outcome = await source.invoke.eraseSubject(subject, choice.strategy) as unknown as IPersonalDataErasure;
        results[choice.id] = { ...outcome, ...decision };
      } catch (error: any) {
        // Recorded, never swallowed: "nothing to erase" and "this source could not run" must not look
        // the same to whoever reads the outcome.
        results[choice.id] = {
          ...PersonalDataErasureService.empty(choice.strategy),
          remaining: 0,
          ...decision,
          error: String(error?.message ?? error),
        };
      }
    }
    return results;
  }

  /**
   * What WOULD be applied to every dataset, without touching a row.
   *
   * The settings page, the DSAR coverage list and the pre-run picker all need the same answer the
   * erasure will act on. Computing it here is what stops a screen showing one policy while the run
   * applies another.
   */
  async resolveStrategies(
    options?: { overrides?: IPersonalDataChoiceMap; actor?: string },
  ): Promise<IPersonalDataPolicyRow[]> {
    const policy = await PersonalDataErasurePolicy.load(this.db, options);
    const targets = [...this.policyTargets(), ...PersonalDataRegistry.listForCurrentTenant()];
    return targets.map((target) => ({
      pluginSlug: target.pluginSlug,
      key: target.key,
      label: target.label,
      fields: Array.isArray((target as any).fields) ? [...(target as any).fields] : [],
      strategies: [...target.strategies],
      defaultStrategy: target.defaultStrategy,
      ...policy.resolve(target),
    }));
  }

  /**
   * The framework's own datasets, wearing the same shape a plugin's source does.
   *
   * `platform` is what the operator's stored choice is keyed against for these — `platform:audit-log`
   * — so core's datasets and a plugin's are addressed identically everywhere a policy is stored,
   * displayed or overridden.
   */
  private policyTargets(): IPersonalDataPolicyTarget[] {
    return this.listDatasets().map((dataset) => ({
      pluginSlug: PersonalDataErasureService.PLATFORM_SLUG,
      key: dataset.key,
      label: dataset.label,
      fields: dataset.fields,
      strategies: dataset.strategies,
      defaultStrategy: dataset.defaultStrategy,
    })) as IPersonalDataPolicyTarget[];
  }

  /** The policy half of an outcome: what was decided, and who decided it. */
  private static decision(target: IPersonalDataPolicyTarget, choice: IPersonalDataStrategyChoice) {
    return {
      label: target.label,
      fields: Array.isArray((target as any).fields) ? [...(target as any).fields] : [],
      strategy: choice.strategy,
      reason: choice.reason,
      source: choice.source,
      provenance: choice.provenance,
      problem: choice.problem,
    };
  }

  async eraseDataset(key: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    if (strategy === PersonalDataErasureService.RETAIN) {
      return PersonalDataErasureService.empty(strategy);
    }

    switch (key) {
      case PersonalDataDatasetKey.ACCOUNT.value: return this.eraseAccount(subject, strategy);
      case PersonalDataDatasetKey.PERSON.value: return this.erasePerson(subject, strategy);
      case PersonalDataDatasetKey.SESSIONS.value: return this.deleteBy(SystemConstants.TABLE.SESSIONS, subject, strategy);
      case PersonalDataDatasetKey.ROLES.value: return this.eraseMembership(subject, strategy);
      case PersonalDataDatasetKey.RECORD_VERSIONS.value: return this.eraseVersions(subject, strategy);
      case PersonalDataDatasetKey.AUDIT_LOG.value: return this.journals.anonymise(PersonalDataJournal.AUDIT, subject, strategy);
      case PersonalDataDatasetKey.SYSTEM_LOG.value: return this.journals.anonymise(PersonalDataJournal.SYSTEM, subject, strategy);
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
    const user = await this.reader.findUser(subject);
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
    const people = await this.reader.findPeople(subject);
    if (people.length === 0) return PersonalDataErasureService.empty(strategy);

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

      if (strategy === PersonalDataErasureService.ANONYMISE) {
        await this.db.update(SystemConstants.TABLE.PEOPLE, { id: person.id }, {
          email: null, phone: null, firstName: PersonalDataErasureService.TOMBSTONE, lastName: null,
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
  private async eraseMembership(subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
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
    const versions = await this.reader.findVersions(subject);
    for (const version of versions) {
      await this.db.delete(SystemConstants.TABLE.RECORD_VERSIONS, { id: (version as any).id });
    }
    return { strategy, erased: versions.length, anonymised: 0, retained: 0, remaining: 0 };
  }


  private async deleteBy(table: string, subject: IPersonalDataSubject, strategy: string): Promise<IPersonalDataErasure> {
    const userId = PersonalDataSubjectReader.userIdOf(subject);
    if (!userId) return PersonalDataErasureService.empty(strategy);
    const rows: any[] = await this.db.find(table, { where: { user_id: userId } });
    for (const row of rows) await this.db.delete(table, { id: row.id });
    return { strategy, erased: rows.length, anonymised: 0, retained: 0, remaining: 0 };
  }


  private static empty(strategy: string): IPersonalDataErasure {
    return { strategy, erased: 0, anonymised: 0, retained: 0, remaining: 0 };
  }
}
