import { RequestContextUtils } from '@core/context/request-context';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { PersonFieldService } from '@core/plugin/services/people/fields/person-field-service';
import type { IPersonFieldInput } from '@core/plugin/services/people/fields/interfaces/person-field-input.interface';

/** `context.people.fields`: the person fields the site declares, and the values a person holds in them. */
export class PeopleFieldsContextProxy {
  static create(db: any) {
    const fields = new PersonFieldService(db);
    const add = async (input: IPersonFieldInput) => { if (!(await fields.get(input?.key))) await fields.save(input); };
    return {
      list: () => fields.list(),
      get: (key: string) => fields.get(key),
      // Same rule as catalogs: outside a tenant (boot, or a platform-scope plugin toggle), every tenant gets the field.
      register: async (input: IPersonFieldInput) => {
        if (RequestContextUtils.storage.getStore()?.tenantId) return add(input);
        await PerTenantRun.forEach({ label: `people:field:${input?.key}`, db, work: () => add(input) });
      },
      values: (personId: any) => fields.values(Number(personId)),
      set: (personId: any, values: Record<string, unknown>) => fields.setValues(Number(personId), values),
    };
  }
}
