export interface User {
  id: string | number;
  email: string;
  roles?: string[] | string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  accountStatus?: string;
  forcePasswordReset?: boolean;
}

export interface UsersPageState {
  searchQuery: string;
  users: User[];
  loading: boolean;
  stats: { total: number; active: number; roles: number };
  deleteConfirm: User | null;
  isDeleting: boolean;
}
