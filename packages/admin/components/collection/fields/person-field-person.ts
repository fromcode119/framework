/**
 * A person from People as the `PersonField` shows and uses them: who they are, and whether they can
 * sign in. `patchFor` turns them into the values of the record's own fields the collection declared.
 */
export class PersonFieldPerson {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly email: string,
    readonly phone: string,
    readonly hasLogin: boolean,
  ) {}

  static from(row: any): PersonFieldPerson | null {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const text = (value: unknown): string => String(value ?? '').trim();
    const joined = [text(row?.firstName), text(row?.lastName)].filter(Boolean).join(' ');
    return new PersonFieldPerson(id, text(row?.displayName) || joined || text(row?.email), text(row?.email), text(row?.phone), row?.userId != null && text(row?.userId) !== '');
  }

  /**
   * The record's fields this person fills, from the field's declared `personFields` map
   * (`{ name: 'fullName', email: 'contactEmail' }`). A key the collection did not declare is not
   * written, and an empty value never overwrites what the record holds.
   */
  patchFor(map: Record<string, unknown> | undefined): Record<string, string> {
    const patch: Record<string, string> = {};
    const values: Record<string, string> = { name: this.name, email: this.email, phone: this.phone };
    for (const [key, target] of Object.entries(map ?? {})) {
      const field = String(target ?? '').trim();
      if (field && values[key]) patch[field] = values[key];
    }
    return patch;
  }
}
