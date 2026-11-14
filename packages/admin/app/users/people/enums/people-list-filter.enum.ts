import { Enum } from '@fromcode119/react-class-components';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';

/** The counted tabs of the people list. `labelKey` is the i18n key the tab shows. */
export class PeopleListFilter extends Enum {
  static readonly ALL = new PeopleListFilter('all', 'users.people');
  static readonly WITH_LOGIN = new PeopleListFilter('with-login', 'users.withLoginAccount');
  static readonly CONTACTS = new PeopleListFilter('contacts', 'users.contactsOnly');

  private constructor(value: string, readonly labelKey: string) {
    super(value);
  }

  static all(): PeopleListFilter[] {
    return [PeopleListFilter.ALL, PeopleListFilter.WITH_LOGIN, PeopleListFilter.CONTACTS];
  }

  static hasLogin(person: IPerson): boolean {
    return person.userId != null && person.userId !== '';
  }

  matches(person: IPerson): boolean {
    if (this === PeopleListFilter.ALL) return true;
    return (this === PeopleListFilter.WITH_LOGIN) === PeopleListFilter.hasLogin(person);
  }
}
