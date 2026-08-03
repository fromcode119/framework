
import type { IUser } from '@/components/interfaces/user.interface';

export interface IAuthProviderViewState {
  user: IUser | null;
  isLoading: boolean;
}
