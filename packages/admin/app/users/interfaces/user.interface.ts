export interface IUser {
  id: string | number;
  email: string;
  roles?: string[] | string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  accountStatus?: string;
  forcePasswordReset?: boolean;
}
