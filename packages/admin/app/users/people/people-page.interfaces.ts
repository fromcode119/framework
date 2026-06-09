export interface Person {
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
  account?: PersonAccountFacet | null;
}

export interface PersonAccountFacet {
  id: number;
  email: string;
  username: string;
  roles: string[];
}

export interface PeoplePageState {
  searchQuery: string;
  page: number;
  people: Person[];
  loading: boolean;
  stats: { total: number; linked: number; unlinked: number };
  grantConfirm: Person | null;
  isGranting: boolean;
  error: string;
}
