import { randomBytes, randomUUID } from 'crypto';
import { BackupOperationError } from './backup-operation-error';
import type { RestorePreviewSession } from './backup-restore-guard-service.interfaces';
import type { RestoreTargetKind } from './backup-restore-guard-service.types';

export class BackupRestorePreviewSessionService {
  private static readonly SESSION_TTL_MS = 10 * 60 * 1000;

  private readonly sessions = new Map<string, RestorePreviewSession>();

  createSession(input: { backupId: string; targetKind: RestoreTargetKind }): RestorePreviewSession {
    this.removeExpiredSessions();

    const session: RestorePreviewSession = {
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
    targetKind: RestoreTargetKind;
    confirmationText: string;
  }): RestorePreviewSession {
    this.removeExpiredSessions();

    const previewToken = String(input.previewToken || '').trim();
    if (!previewToken) {
      throw new BackupOperationError(409, 'Restore preview token is required. Run restore preview again before executing restore.');
    }

    const session = this.sessions.get(previewToken);
    if (!session) {
      throw new BackupOperationError(409, 'Restore preview session was not found or has expired. Run restore preview again.');
    }

    if (session.backupId !== input.backupId || session.targetKind !== input.targetKind) {
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