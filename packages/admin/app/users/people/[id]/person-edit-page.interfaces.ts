import type { Person } from '../people-page.interfaces';

export interface PersonEditPageProps {
  params: Promise<{ id: string }>;
}

export interface PersonEditPageState {
  routeId: string;
  person: Person | null;
  fields: PersonEditPageFields;
  loading: boolean;
  saving: boolean;
  granting: boolean;
  error: string;
  notFound: boolean;
}

export interface PersonEditPageFields {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  birthDate: string;
}
