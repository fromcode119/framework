import { describe, it, expect } from 'vitest';
import { PersonFieldPerson } from '@/components/collection/fields/person-field-person';

describe('PersonFieldPerson', () => {
  it('names a person from displayName, else first + last, and knows whether they can sign in', () => {
    expect(PersonFieldPerson.from({ id: 31, displayName: 'Анита Иванова', email: 'a@x.test', userId: 4 })).toMatchObject({ name: 'Анита Иванова', hasLogin: true });
    expect(PersonFieldPerson.from({ id: 5, firstName: 'Ana', lastName: 'Test', userId: null })).toMatchObject({ name: 'Ana Test', hasLogin: false });
    expect(PersonFieldPerson.from({ id: 0 })).toBeNull();
  });

  it("fills only the record fields the collection declared, never with an empty value", () => {
    const person = PersonFieldPerson.from({ id: 31, displayName: 'Anita', email: 'a@x.test', phone: '' })!;
    expect(person.patchFor({ name: 'name', email: 'email', phone: 'phone' })).toEqual({ name: 'Anita', email: 'a@x.test' });
    expect(person.patchFor({ email: 'contactEmail' })).toEqual({ contactEmail: 'a@x.test' });
    expect(person.patchFor(undefined)).toEqual({});
  });
});
