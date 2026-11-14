import { Enum } from '@fromcode119/react-class-components';
import type { IUser } from '@/app/users/interfaces/user.interface';
import { AccountStatus } from '@/app/users/enums/account-status.enum';

/** The counted tabs of the users list. The value is the i18n key under `users.filter`. */
export class UserListFilter extends Enum {
  static readonly ALL = new UserListFilter('all');
  static readonly ACTIVE = new UserListFilter('active');
  static readonly SUSPENDED = new UserListFilter('suspended');

  private constructor(value: string) {
    super(value);
  }

  static all(): UserListFilter[] {
    return [UserListFilter.ALL, UserListFilter.ACTIVE, UserListFilter.SUSPENDED];
  }

  matches(user: IUser): boolean {
    if (this === UserListFilter.ALL) return true;
    const status = AccountStatus.resolve(user.accountStatus);
    return this === UserListFilter.SUSPENDED ? status === AccountStatus.SUSPENDED : status === AccountStatus.ACTIVE;
  }
}
