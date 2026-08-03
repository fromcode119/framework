import { randomBytes, randomUUID } from 'crypto';
import { BackupOperationError } from '@core/management/backup-operation-error';
import type { IRestorePreviewSession } from '@core/management/interfaces/restore-preview-session.interface';
import type { RestoreTarget } from '@core/management/restore-target';

export class BackupRestorePreviewSessionService {
  private static readonly SESSION_TTL_MS = 10 * 60 * 1000;

  private readonly sessions = new Map<string, IRestorePreviewSession>();

  createSession(input: { backupId: string; targetKind: RestoreTarget }): IRestorePreviewSession {
    this.removeExpiredSessions();

    const session: IRestorePreviewSession = {
      token: randomUUID(),
      backupId: input.backupId,
      targetKind: input.targetKind,
      requiredConfirmationText: this.createConfirmationText(),
      expiresAt: new Date(Date.now() + BackupRestorePreviewSessionService.SESSION_TTL_MS).toISOString(),
    };

    this.sessions.set(session.token, session);
    return session;
  }

  consumeSession(input: {
    previewToken: string;
    backupId: string;
    targetKind: RestoreTarget;
    confirmationText: string;
  }): IRestorePreviewSession {
    this.removeExpiredSessions();

    const previewToken = String(input.previewToken || '').trim();
    if (!previewToken) {
      throw new BackupOperationError(409, 'Restore preview token is required. Run restore preview again before executing restore.');
    }

    const session = this.sessions.get(previewToken);
    if (!session) {
      throw new BackupOperationError(409, 'Restore preview session was not found or has expired. Run restore preview again.');
    }

    // Compare the target by VALUE, not identity: `RestoreTarget.parse()` builds a NEW instance per call,
    // so `!==` on the objects is always true and every execute would be rejected. (`toString()` yields the
    // wire form the session was created from.)
    const sameTarget = String(session.targetKind) === String(input.targetKind);
    if (session.backupId !== input.backupId || !sameTarget) {
      this.sessions.delete(previewToken);
      throw new BackupOperationError(409, 'Restore preview session does not match the requested backup target. Run restore preview again.');
    }

    if (String(input.confirmationText || '').trim() !== session.requiredConfirmationText) {
      throw new BackupOperationError(409, 'Restore confirmation text did not match the required confirmation challenge.');
    }

    this.sessions.delete(previewToken);
    return session;
  }

  private createConfirmationText(): string {
    return `CONFIRM RESTORE ${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  private removeExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (Date.parse(session.expiresAt) <= now) {
        this.sessions.delete(token);
      }
    }
  }
}