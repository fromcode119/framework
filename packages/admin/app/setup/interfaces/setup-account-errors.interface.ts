/** Per-field messages the account step renders under its inputs; absent means the field is fine. */
export interface ISetupAccountErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}
