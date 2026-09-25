import type { ReactNode } from 'react';
import { Input } from '@/components/ui/view/input.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import type { IPersonEditPageFields } from '@/app/users/people/[id]/interfaces/person-edit-page-fields.interface';
import { prop, state } from '@fromcode119/react-class-components';

/**
 * The person being edited, as a list of FIELDS rather than a fixed form.
 *
 * The base of this page's chain — the loads and writes, then the markup.
 *
 * The fields come from the collection's own schema, so a field added to People appears here without
 * this screen naming it; a hand-listed form would silently stop showing new ones.
 */
export abstract class PersonEditPageState extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state person: IPerson | null = null;
  @state fields: IPersonEditPageFields = { firstName: '', lastName: '', displayName: '', email: '', phone: '', birthDate: '' };
  @state loading = true;
  @state saving = false;
  @state granting = false;
  @state sendingReset = false;
  @state notice = '';
  @state error = '';
  @state notFound = false;
  /** Set when the person request FAILED. Distinct from `notFound`, which means the server answered
   *  and the record does not exist — a failed request must never be reported as "does not exist". */
  @state loadError = '';
  @state users: Array<{ id: number; email?: string; username?: string }> = [];
  @state confirmDelete = false;
  @state deleting = false;
  @state reassignOpen = false;
  @state reassignTo = '';
  @state reassigning = false;

  protected mounted = false;

  protected static toFields(person: IPerson | null): IPersonEditPageFields {
    return {
      firstName: String(person?.firstName ?? ''),
      lastName: String(person?.lastName ?? ''),
      displayName: String(person?.displayName ?? ''),
      email: String(person?.email ?? ''),
      phone: String(person?.phone ?? ''),
      birthDate: String(person?.birthDate ?? ''),
    };
  }

  protected set<K extends keyof IPersonEditPageFields>(key: K, value: string): void {
    this.fields = { ...this.fields, [key]: value };
  }

  protected field(label: string, key: keyof IPersonEditPageFields, type = 'text', locked = false): ReactNode {
    return (
      <label className="block">
        <span className="block text-[11px] font-bold tracking-tight text-slate-500 mb-1.5">{label}</span>
        <Input type={type} value={this.fields[key]} disabled={this.saving || locked}
          onChange={(e) => this.set(key, e.target.value)} className="w-full" />
      </label>
    );
  }
}
