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
  sendingReset: boolean;
  notice: string;
  error: string;
  notFound: boolean;
  users: Array<{ id: number; email?: string; username?: string }>;
  confirmDelete: boolean;
  deleting: boolean;
  reassignOpen: boolean;
  reassignTo: string;
  reassigning: boolean;
}

export interface PersonEditPageFields {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  birthDate: string;
}
