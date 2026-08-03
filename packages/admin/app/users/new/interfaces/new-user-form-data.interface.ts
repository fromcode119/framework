export interface INewUserFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  forcePasswordReset: boolean;
  password: string;
  confirmPassword: string;
  roles: string[];
}
