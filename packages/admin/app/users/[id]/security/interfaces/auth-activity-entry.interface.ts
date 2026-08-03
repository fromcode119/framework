export interface IAuthActivityEntry {
  context?: {
    email?: string;
  };
  createdAt?: string;
  email?: string;
  id?: number | string;
  level?: string;
  message?: string;
  timestamp?: string;
}
