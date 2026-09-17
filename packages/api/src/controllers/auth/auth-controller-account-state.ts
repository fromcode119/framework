import { AuthControllerInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-infrastructure';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';

/**
 * The per-account flags a login has to consult: password history, status, and a forced reset.
 *
 * Password HISTORY is why reuse can be refused — a policy that says "not one of your last N" needs
 * the last N hashes kept, and they are kept as hashes, never as anything reversible. Status and the
 * force-reset flag are read on every login, so they live beside the history rather than in a table
 * the login path would have to join.
 */
export class AuthControllerAccountState extends AuthControllerInfrastructure {
  protected getPasswordHistoryKey(userId: number) {
    return `user:${userId}:password_history`;
  }

  protected getPasswordChangedAtKey(userId: number) {
    return `user:${userId}:password_changed_at`;
  }

  protected async readPasswordHistory(userId: number): Promise<string[]> {
    const row = await this.readMetaRow(this.getPasswordHistoryKey(userId));
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry: any) => String(entry || '')).filter(Boolean);
    } catch {
      return [];
    }
  }

  protected async pushPasswordHistory(userId: number, hash: string) {
    const history = await this.readPasswordHistory(userId);
    const next = [String(hash), ...history.filter((entry) => String(entry) !== String(hash))];
    await this.upsertMeta(this.getPasswordHistoryKey(userId), JSON.stringify(next.slice(0, 25)));
  }

  protected getUserAccountStatusKey(userId: number) {
    return `user:${userId}:account_status`;
  }

  protected getForcePasswordResetKey(userId: number) {
    return `user:${userId}:force_password_reset`;
  }

  protected async setUserAccountStatus(userId: number, status: AccountStatus) {
    await this.upsertMeta(this.getUserAccountStatusKey(userId), status.value);
  }

  protected async getUserAccountStatus(userId: number): Promise<AccountStatus> {
    const row = await this.readMetaRow(this.getUserAccountStatusKey(userId));
    const value = String(row?.value || '').trim().toLowerCase();
    return AccountStatus.resolve(value);
  }

  protected async setForcePasswordReset(userId: number, enabled: boolean) {
    await this.upsertMeta(this.getForcePasswordResetKey(userId), enabled ? 'true' : 'false');
  }

  protected async getForcePasswordReset(userId: number): Promise<boolean> {
    const row = await this.readMetaRow(this.getForcePasswordResetKey(userId));
    return String(row?.value || '').trim().toLowerCase() === 'true';
  }
}
