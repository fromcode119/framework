export interface User {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string | undefined, user: User) => void;
  logout: () => void;
}
