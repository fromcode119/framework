import { Request, Response } from 'express';
import fs from 'fs';
import { ArchiveUploadSessionService, PluginManager } from '@fromcode119/core';
import { PluginInstallOperationService } from '@api/services/plugin-install-operation-service';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';

/**
 * Receiving a plugin ARCHIVE: direct upload, chunked upload sessions, and inspecting what was staged
 * before anything is installed.
 *
 * Split out of PluginController (483 lines) 2026-09-09, the same way PluginArchiveSupport was.
 * Routed directly by PluginRouter.
 */
export class PluginUploadController {
  private operations = PluginInstallOperationService.getInstance();
  private archiveSupport: PluginArchiveSupport;

  constructor(private manager: PluginManager) {
    this.archiveSupport = new PluginArchiveSupport(manager);
  }

  private static readonly ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz'];

  private startArchiveInstallOperation(detachedArchivePath: string) {
    return this.operations.start('upload', 'archive install', async (reportProgress) => {
      try {
        await this.manager.installUploadedPluginArchive(detachedArchivePath, {
          enable: true,
          progressReporter: reportProgress,
        });
      } finally {
        if (fs.existsSync(detachedArchivePath)) {
          fs.unlinkSync(detachedArchivePath);
        }
      }
    });
  }


  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const detachedArchivePath = this.archiveSupport.createDetachedArchiveCopy(req.file.path, req.file.originalname);
      const operation = this.startArchiveInstallOperation(detachedArchivePath);
      res.status(202).json({ success: true, operationId: operation.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }


  async inspectUpload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const info = await this.archiveSupport.inspectPluginArchive(req.file.path, req.file.originalname);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid plugin archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }


  async startUploadSession(req: Request, res: Response) {
    try {
      const payload = this.archiveSupport.readUploadSessionRequest(req.body);
      res.status(201).json({
        success: true,
        ...ArchiveUploadSessionService.startSession(
          payload.originalFilename,
          payload.totalSizeBytes,
          payload.totalChunks,
          PluginUploadController.ALLOWED_ARCHIVE_EXTENSIONS,
        ),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not start upload session.' });
    }
  }


  async uploadChunk(req: any, res: Response) {
    try {
      const payload = this.archiveSupport.readChunkUploadRequest(req);
      const result = ArchiveUploadSessionService.appendChunk(payload.uploadId, payload.filePath, payload.chunkIndex, payload.totalChunks);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not upload plugin package chunk.' });
    }
  }


  async inspectStagedUpload(req: Request, res: Response) {
    try {
      const uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const info = await this.archiveSupport.inspectPluginArchive(uploadedArchive.filePath, uploadedArchive.originalFilename);
      res.json({ success: true, uploadId, info });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Invalid plugin archive' });
    }
  }


  async completeStagedUpload(req: Request, res: Response) {
    let uploadId = '';
    try {
      uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const detachedArchivePath = this.archiveSupport.createDetachedArchiveCopy(uploadedArchive.filePath, uploadedArchive.originalFilename);
      const operation = this.startArchiveInstallOperation(detachedArchivePath);
      res.status(202).json({ success: true, operationId: operation.id });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message || 'Could not install plugin package.' });
    } finally {
      if (uploadId) {
        ArchiveUploadSessionService.discardSession(uploadId);
      }
    }
  }
}
