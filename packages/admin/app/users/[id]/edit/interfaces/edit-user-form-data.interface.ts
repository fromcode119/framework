export interface IEditUserFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  forcePasswordReset: boolean;
  password: string;
  /** Required when you change your OWN password in self-service mode. */
  currentPassword?: string;
  confirmPassword: string;
}
