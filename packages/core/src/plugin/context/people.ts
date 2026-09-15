import { NamingStrategy } from '@fromcode119/database';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { RequestContextUtils } from '@core/context/request-context';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PersonCatalogService } from '@core/plugin/services/people/person-catalog-service';
import { PeopleAddressService } from '@core/plugin/services/people/people-address-service';
import { PeopleDirectoryService } from '@core/plugin/services/people/people-directory-service';
import { PersonalDataErasureService } from '@core/plugin/services/people/personal-data-erasure-service';
import { PersonalDataRegistry } from '@core/plugin/services/people/personal-data-registry';
import { PersonalDataErasurePolicy } from '@core/plugin/services/people/personal-data-erasure-policy';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import type { IPersonalDataChoiceMap } from '@core/plugin/services/people/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataSourceDescriptor } from '@core/plugin/services/interfaces/personal-data-source-descriptor.interface';
import { MetaContextProxy } from '@core/plugin/context/meta';
import type { IPeopleAddressRef } from '@core/plugin/services/interfaces/people-address-ref.interface';

export class PeopleContextProxy {

  static createPeopleProxy(
    _plugin: ILoadedPlugin,
    manager: IPluginManagerInterface,
    pluginDb: any
  ) {
    const db = manager.db as any;
    const catalogs = new PersonCatalogService(db);
    const addresses = new PeopleAddressService(db);
    // The framework's own personal data. Core-owned because plugins may not touch system tables.
    const personalDataService = new PersonalDataErasureService(db);

    async function match(input: { userId?: any; email?: string; phone?: string }) {
      if (input?.userId != null && input.userId !== '') {
        const byUser = await db.findOne(SystemConstants.TABLE.PEOPLE, { userId: input.userId });
        if (byUser) return PeopleContextProxy.toPerson(byUser);
      }
      const email = PeopleContextProxy.foldEmail(input?.email);
      if (email) {
        const byEmail = await db.findOne(SystemConstants.TABLE.PEOPLE, { email });
        if (byEmail) return PeopleContextProxy.toPerson(byEmail);
      }
      const phone = String(input?.phone ?? '').trim();
      if (phone) {
        const byPhone = await db.findOne(SystemConstants.TABLE.PEOPLE, { phone });
        if (byPhone) return PeopleContextProxy.toPerson(byPhone);
      }
      return null;
    }

    async function upsert(input: Record<string, any>) {
      const data = PeopleContextProxy.normalizeWrite(input);
      const existing = await match({ userId: input?.userId, email: input?.email, phone: input?.phone });
      if (existing) {
        // `displayName` is USER-OWNED: it is set/cleared only via the admin person editor (which writes
        // through db.update, not this upsert). Plugin people syncs funnel here with a plugin-derived
        // name; letting them overwrite displayName clobbered an admin-set name and made a deliberately
        // CLEARED displayName reappear on the next sync. Seed it on first insert, but never mutate it
        // for an existing person — the person row owns it from then on.
        const update = { ...data };
        delete (update as any).displayName;
        if (Object.keys(update).length > 0) {
          await db.update(SystemConstants.TABLE.PEOPLE, { id: existing.id }, update);
        }
        return { ...existing, ...update };
      }
      return PeopleContextProxy.toPerson(await db.insert(SystemConstants.TABLE.PEOPLE, data));
    }

    const directory = new PeopleDirectoryService(
      String(_plugin?.manifest?.slug || ''),
      pluginDb,
      MetaContextProxy.createMetaProxy(manager),
      match,
      upsert
    );

    return {
      match,

      upsert,

      /**
       * Resolve (or create) the person for one identity payload from a plugin row, filling only the
       * fields the person does not already have. The framework owns the match/merge rules — a plugin
       * never hand-rolls them and never touches the `people` table.
       */
      ingest: (input: Record<string, any>) => directory.ingest(input),

      /**
       * Ingest rows of one of THIS plugin's own tables into the people directory, resuming from a
       * framework-owned cursor so only rows added since the last run are read. Replaces the
       * whole-table scan every plugin used to run at boot.
       */
      syncDirectory: (
        table: string,
        map: (row: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>,
        batch?: number
      ) => directory.sync(table, map, batch),

      async getById(id: any) {
        if (id == null || id === '') return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { id }));
      },

      async getByUserId(userId: any) {
        if (userId == null || userId === '') return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { userId }));
      },

      async getByEmail(email: string) {
        const folded = PeopleContextProxy.foldEmail(email);
        if (!folded) return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { email: folded }));
      },

      async linkAccount(personId: any, userId: any) {
        if (personId == null || userId == null) return null;
        return db.update(SystemConstants.TABLE.PEOPLE, { id: personId }, { userId });
      },

      async addRelationship(fromPersonId: any, toPersonId: any, type: string, metadata?: Record<string, any>) {
        return db.insert(SystemConstants.TABLE.PERSON_RELATIONSHIPS, {
          fromPersonId,
          toPersonId,
          type: String(type ?? '').trim(),
          metadata: metadata ?? {}
        });
      },

      async listRelated(fromPersonId: any, type?: string) {
        const where: Record<string, any> = { fromPersonId };
        if (type) where.type = String(type).trim();
        const rows = await db.find(SystemConstants.TABLE.PERSON_RELATIONSHIPS, { where });
        return (Array.isArray(rows) ? rows : []).map(PeopleContextProxy.toRelationship);
      },

      catalogs: {
        /**
         * Registering a catalog value, from wherever the plugin calls it.
         *
         * Inside a request there is a tenant and this is one write. At BOOT — where every plugin
         * declaring its own vocabulary calls it, in `onInit` — there is none, and `person_catalogs`
         * is tenant-scoped: the row's `tenant_id` defaults to NULL and the policy checks
         * `tenant_id = current_setting(...)`, so NULL = NULL is not TRUE and the write is refused.
         * Three plugins and the framework's own seed failed that way on every boot, each reporting
         * it as its own warning, and the values existed only for tenants that happened to reach this
         * code inside a request.
         *
         * So a boot-time registration is applied to every tenant. The plugin says WHAT its
         * vocabulary is; which tenants have it is not a question a plugin should have to ask.
         */
        register: async (kind: string, entry: { key: string; label: string; pluginSlug?: string }) => {
          if (RequestContextUtils.storage.getStore()) return catalogs.register(kind, entry);
          await PerTenantRun.forEach({
            label: `people:catalog:${kind}:${entry?.key}`,
            db: db as any,
            work: async () => { await catalogs.register(kind, entry); },
          });
        },
        list: (kind: string) => catalogs.list(kind),
        unregister: (kind: string, key: string) => catalogs.remove(kind, key)
      },

      // Reusable address book on the shared `people_addresses` table. Plugins delegate their account
      // address book here instead of owning a parallel store. `ref` resolves the owning person from
      // { personId } | { userId } | { email }; upsert creates a minimal person when none exists yet.
      addresses: {
        list: (ref: IPeopleAddressRef) => addresses.list(ref),
        upsert: (ref: IPeopleAddressRef, addr: Record<string, any>) => addresses.upsert(ref, addr),
        delete: (addressId: any) => addresses.delete(addressId),
        setDefault: (ref: IPeopleAddressRef, addressId: any) => addresses.setDefault(ref, addressId)
      },

      // The framework's OWN personal data — account, person, sessions, roles, edit history, journals.
      // Core-owned because a plugin may never touch a system table, so the privacy plugin cannot
      // honour a DSAR over them itself. It registers these datasets; core does the writing.
      personalData: {
        listDatasets: () => personalDataService.listDatasets(),
        exportDataset: (key: string, subject: any) => personalDataService.exportDataset(key, subject),
        eraseDataset: (key: string, subject: any, strategy: string) => personalDataService.eraseDataset(key, subject, strategy),

        /**
         * Declare a dataset THIS plugin holds. Data only — the methods are named, never passed, so
         * the descriptor survives the channel to an isolated guest.
         *
         * The callback is built HERE, from the plugin manager's own API resolver, so the framework
         * reaches the plugin directly instead of hopping through `context.plugins.namespace`. That
         * hop is what required a `plugins:interact` capability and failed silently for any plugin
         * that had not declared one.
         */
        registerSource: (descriptor: IPersonalDataSourceDescriptor) => {
          const call = async (method: string, args: Record<string, unknown>): Promise<any> => {
            const api: any = new PluginsManagerResolver(manager.plugins as any)
              .resolve(descriptor.namespace, descriptor.pluginSlug);
            // Two different failures, and they send an operator to different places: a plugin that is
            // not reachable (inactive, or not enabled for this site) is a CONFIGURATION answer, while
            // one that is reachable but missing the method is a CODE answer. Reported as one message
            // they are indistinguishable — "social-proof does not expose exportPersonalData" reads as
            // a missing method even when the plugin is simply switched off for this site.
            if (!api) {
              throw new Error(
                `${descriptor.pluginSlug} is not reachable (inactive, or not enabled for this site), ` +
                `so ${descriptor.key} was not searched`,
              );
            }
            if (typeof api[method] !== 'function') {
              throw new Error(`${descriptor.pluginSlug} does not expose ${method}`);
            }
            return api[method](args);
          };

          return PersonalDataRegistry.register(descriptor, {
            exportSubject: async (subject: unknown) => {
              const rows = await call(descriptor.methods.export, { key: descriptor.key, subject });
              return Array.isArray(rows) ? rows : [];
            },
            eraseSubject: (subject: unknown, strategy: string) =>
              call(descriptor.methods.erase, { key: descriptor.key, subject, strategy }),
          });
        },

        /**
         * Every dataset any plugin has declared. DATA ONLY — the registered `invoke` callbacks are
         * stripped, because an isolated plugin reads this over a structured-clone channel and a
         * function cannot cross it. The caller runs a source through `exportSource`/`eraseSource`,
         * naming it by id, exactly as registration names its methods rather than passing them.
         */
        listSources: () => PersonalDataRegistry.listForCurrentTenant().map(({ invoke: _invoke, ...descriptor }) => descriptor),

        /** Run one registered source's export, by `pluginSlug:key`. */
        exportSource: (id: string, subject: any) => {
          const source = PersonalDataRegistry.get(id);
          if (!source) throw new Error(`Unknown personal-data source "${id}"`);
          return source.invoke.exportSubject(subject);
        },

        /** Run one registered source's erasure, by `pluginSlug:key`. */
        eraseSource: (id: string, subject: any, strategy: string) => {
          const source = PersonalDataRegistry.get(id);
          if (!source) throw new Error(`Unknown personal-data source "${id}"`);
          return source.invoke.eraseSubject(subject, strategy);
        },

        /**
         * Erase the subject everywhere — the framework's own datasets AND every registered plugin
         * source — under the operator's own policy.
         *
         * The strategy is NOT the caller's to supply. Core reads the site's policy and the platform
         * default itself, so a plugin cannot disagree with `deleteMyAccount` about what a site
         * decided. `overrides` is the one exception and it is data, not a callback: a per-run choice
         * for THIS request (a legal hold on one dataset for one subject), which leaves the site's
         * standing policy untouched. A function could not cross to an isolated guest anyway.
         */
        eraseAll: (subject: any, options?: { overrides?: IPersonalDataChoiceMap; actor?: string }) =>
          personalDataService.eraseAll(subject, options),

        /**
         * What WOULD be applied to every dataset, without touching a row — each with the layer that
         * decided it, so a screen can name where a value came from instead of implying somebody chose it.
         */
        resolveStrategies: (options?: { overrides?: IPersonalDataChoiceMap; actor?: string }) =>
          personalDataService.resolveStrategies(options),

        /**
         * Carry a policy this plugin used to own into the framework, as THIS SITE's.
         *
         * Core decides the scope, not the caller: it writes only inside a request that names a site,
         * and only when the site has no policy of its own yet. A plugin cannot reach the setting any
         * other way, so it cannot fan one site's decision across the deployment by accident.
         * Returns whether anything was written.
         */
        adoptSitePolicy: (stored: IPersonalDataChoiceMap) =>
          PersonalDataErasurePolicy.adoptSitePolicy(manager.db, stored),

        unregisterSources: (pluginSlug: string) => PersonalDataRegistry.unregisterByPlugin(pluginSlug)
      }
    };
  }

  private static foldEmail(email?: string): string {
    return String(email ?? '').trim().toLowerCase();
  }

  private static normalizeWrite(input: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...input };
    if (typeof data.email === 'string') data.email = PeopleContextProxy.foldEmail(data.email);
    if (typeof data.phone === 'string') data.phone = data.phone.trim();
    // A blank userId must never reach the people.user_id column — it is an INTEGER FK to users.id,
    // so '' or whitespace would throw "FOREIGN KEY constraint failed". Omit it (leave existing/NULL).
    if (data.userId == null || String(data.userId).trim() === '') delete data.userId;
    return data;
  }

  // Reads from the RAW manager.db return snake_case columns; map to the camelCase
  // shape plugins expect. The proxy reads via the raw DB manager (snake_case columns), so we
  // denormalize the row to camelCase ONCE and then map a single canonical (camelCase) name per
  // field — no dual camel/snake lookups. `denormalizeRecord` is idempotent on already-camelCase
  // keys, so this also works against the camelCase rows used by the unit-test mocks.
  private static toPerson(row: any): any {
    if (!row) return null;
    const r = NamingStrategy.denormalizeRecord(row);
    return {
      id: r.id,
      userId: r.userId ?? null,
      status: r.status ?? null,
      source: r.source ?? null,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      middleName: r.middleName ?? null,
      displayName: r.displayName ?? null,
      preferredName: r.preferredName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      birthDate: r.birthDate ?? null,
      gender: r.gender ?? null,
      pronouns: r.pronouns ?? null,
      preferredLocale: r.preferredLocale ?? null,
      timezone: r.timezone ?? null,
      country: r.country ?? null,
      avatarUrl: r.avatarUrl ?? null,
      bio: r.bio ?? null,
      metadata: r.metadata ?? null,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null
    };
  }

  private static toRelationship(row: any): any {
    if (!row) return null;
    const r = NamingStrategy.denormalizeRecord(row);
    return {
      id: r.id,
      fromPersonId: r.fromPersonId ?? null,
      toPersonId: r.toPersonId ?? null,
      type: r.type ?? null,
      metadata: r.metadata ?? null
    };
  }
}
