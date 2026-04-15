import { Request, Response } from 'express';
import type { RestoreTargetKind } from '@fromcode119/core';
import { SystemBackupService } from '../../services/system-backup-service';

export class SystemBackupController {
  constructor(private readonly service: SystemBackupService) {}

  async listBackups(req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.service.listBackups(this.resolveCapabilities(req)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async createSystemBackup(req: Request, res: Response): Promise<void> {
    try {
      res.status(201).json(await this.service.createSystemBackup(this.resolveActor(req), this.readCreateRequest(req.body)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async importBackup(req: Request, res: Response): Promise<void> {
    try {
      const uploadedBackup = this.readUploadedBackup(req);
      res.status(201).json(await this.service.importBackup(this.resolveActor(req), uploadedBackup.filePath, uploadedBackup.originalFilename));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async downloadBackup(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.service.resolveDownload(String(req.params.id || ''), this.resolveActor(req));
      res.download(result.filePath, result.filename);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deleteBackup(req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.service.deleteBackup(String(req.params.id || ''), this.resolveActor(req)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async previewRestore(req: Request, res: Response): Promise<void> {
    try {
      const targetKind = this.readTargetKind(req.body?.targetKind);
      res.json(await this.service.previewRestore(String(req.params.id || ''), targetKind, this.resolveActor(req)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async executeRestore(req: Request, res: Response): Promise<void> {
    try {
      const targetKind = this.readTargetKind(req.body?.targetKind);
      const previewToken = String(req.body?.previewToken || '').trim();
      const confirmationText = String(req.body?.confirmationText || '').trim();
      res.json(
        await this.service.executeRestore(
          String(req.params.id || ''),
          targetKind,
          previewToken,
          confirmationText,
          this.resolveActor(req),
        ),
      );
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private resolveActor(req: Request): Record<string, unknown> {
    const authenticatedRequest = req as Request & {
      user?: { id?: unknown; email?: unknown; roles?: unknown[]; permissions?: unknown[] };
    };

    return {
      userId: authenticatedRequest.user?.id ?? null,
      email: authenticatedRequest.user?.email ?? null,
      roles: Array.isArray(authenticatedRequest.user?.roles) ? authenticatedRequest.user?.roles : [],
    };
  }

  private resolveCapabilities(req: Request): { canManage: boolean; canRestore: boolean } {
    return {
      canManage: this.hasPermission(req, 'system:backup:manage'),
      canRestore: this.hasPermission(req, 'system:backup:restore'),
    };
  }

  private hasPermission(req: Request, permission: string): boolean {
    const authenticatedRequest = req as Request & {
      user?: { roles?: unknown[]; permissions?: unknown[] };
    };
    const permissions = Array.isArray(authenticatedRequest.user?.permissions)
      ? authenticatedRequest.user?.permissions.map((entry) => String(entry))
      : [];
    const roles = Array.isArray(authenticatedRequest.user?.roles)
      ? authenticatedRequest.user?.roles.map((entry) => String(entry).toLowerCase())
      : [];
    return roles.includes('admin') || permissions.includes('*') || permissions.includes(permission);
  }

  private readTargetKind(value: unknown): RestoreTargetKind {
    const targetKind = String(value || '').trim();
    if (!targetKind) {
      throw new Error('targetKind is required.');
    }
    return targetKind as RestoreTargetKind;
  }

  private readCreateRequest(body: unknown): { sections?: ('core' | 'database' | 'plugins' | 'themes')[] } {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sections = this.readBackupSections((body as { sections?: unknown }).sections);
    return sections.length ? { sections } : {};
  }

  private readBackupSections(value: unknown): ('core' | 'database' | 'plugins' | 'themes')[] {
    if (value === undefined) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error('sections must be an array.');
    }

    const allowedSections = ['core', 'database', 'plugins', 'themes'];
    const sections = Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
    if (sections.some((section) => !allowedSections.includes(section))) {
      throw new Error('Unsupported backup section selection.');
    }

    return sections as ('core' | 'database' | 'plugins' | 'themes')[];
  }

  private readUploadedBackup(req: Request): { filePath: string; originalFilename: string } {
    const uploadRequest = req as Request & {
      file?: { path?: unknown; originalname?: unknown };
    };
    const filePath = String(uploadRequest.file?.path || '').trim();
    if (!filePath) {
      throw new Error('backup file is required.');
    }

    return {
      filePath,
      originalFilename: String(uploadRequest.file?.originalname || 'imported-backup.tar.gz').trim(),
    };
  }

  private handleError(res: Response, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unexpected backup operation failure.';
    const statusCode = this.resolveStatusCode(error, message);
    res.status(statusCode).json({ error: message });
  }

  private resolveStatusCode(error: unknown, message: string): number {
    const statusCode = this.readStatusCode(error);
    if (statusCode) return statusCode;
    if (message.includes('not found')) return 404;
    if (message.includes('does not exist')) return 409;
    if (message.includes('confirmation')) return 409;
    if (message.includes('Invalid') || message.includes('required') || message.includes('Unsupported')) return 400;
    if (message.includes('Only managed backups')) return 403;
    return 500;
  }

  private readStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' && Number.isInteger(statusCode) ? statusCode : null;
  }
}