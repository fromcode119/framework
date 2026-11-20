/** A step on the security page that waits for a yes in the console's confirm dialog. */
export interface IUserSecurityConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<void>;
}
