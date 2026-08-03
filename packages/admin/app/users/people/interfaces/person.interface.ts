import type { IPersonAccountFacet } from '@/app/users/people/interfaces/person-account-facet.interface';

export interface IPerson {
  id: string | number;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  source?: string;
  userId?: string | number | null;
  status?: string;
  createdAt?: string;
  account?: IPersonAccountFacet | null;
}
