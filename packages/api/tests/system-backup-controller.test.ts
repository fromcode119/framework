import { SystemBackupController } from '../src/controllers/system/system-backup-controller';

describe('SystemBackupController', () => {
  it('returns list payloads from the service', async () => {
    const service = {
      listBackups: jest.fn().mockResolvedValue({ groups: [], capabilities: { canManage: false, canRestore: false } }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.listBackups({ user: { roles: ['editor'], permissions: [] } } as any, res as any);

    expect(service.listBackups).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ groups: [], capabilities: { canManage: false, canRestore: false } });
  });

  it('maps restore confirmation failures to a conflict response', async () => {
    const service = {
      executeRestore: jest.fn().mockRejectedValue(new Error('Restore confirmation text did not match the required confirmation challenge.')),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.executeRestore({
      params: { id: 'backup-id' },
      body: { targetKind: 'system', previewToken: 'preview-token', confirmationText: 'wrong' },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restore confirmation text did not match the required confirmation challenge.' });
  });

  it('maps missing restore targets to a conflict response when the service exposes a status code', async () => {
    const error = Object.assign(new Error('Plugin "missing" does not exist.'), { statusCode: 409 });
    const service = {
      previewRestore: jest.fn().mockRejectedValue(error),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.previewRestore({
      params: { id: 'backup-id' },
      body: { targetKind: 'plugin:missing' },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Plugin "missing" does not exist.' });
  });

  it('passes selected backup sections into create requests', async () => {
    const service = {
      createSystemBackup: jest.fn().mockResolvedValue({ success: true, backup: { id: '1' }, selection: { requestedSections: ['core'], includedSections: ['core'], warnings: [] } }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.createSystemBackup({ body: { sections: ['core', 'themes'] }, user: { roles: ['admin'], permissions: ['*'] } } as any, res as any);

    expect(service.createSystemBackup).toHaveBeenCalledWith(
      expect.any(Object),
      { sections: ['core', 'themes'] },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('passes uploaded backup files into import requests', async () => {
    const service = {
      importBackup: jest.fn().mockResolvedValue({ success: true, backup: { id: '1' }, selection: { requestedSections: [], includedSections: [], warnings: [] } }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.importBackup({
      file: { path: '/tmp/uploaded-backup.tar.gz', originalname: 'system-2026-04-15.tar.gz' },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(service.importBackup).toHaveBeenCalledWith(
      expect.any(Object),
      '/tmp/uploaded-backup.tar.gz',
      'system-2026-04-15.tar.gz',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('starts chunked import sessions with validated payloads', async () => {
    const service = {
      startBackupImportSession: jest.fn().mockResolvedValue({ success: true, uploadId: 'session-1', chunkSizeBytes: 4194304, totalChunks: 5, originalFilename: 'backup.tar.gz' }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.startImportSession({
      body: { originalFilename: 'backup.tar.gz', totalSizeBytes: 1024, totalChunks: 5 },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(service.startBackupImportSession).toHaveBeenCalledWith('backup.tar.gz', 1024, 5);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('passes uploaded chunk files into chunk import requests', async () => {
    const service = {
      uploadBackupImportChunk: jest.fn().mockResolvedValue({ success: true, uploadId: 'session-1', receivedChunks: 1, totalChunks: 5, complete: false }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.uploadImportChunk({
      body: { uploadId: 'session-1', chunkIndex: '0', totalChunks: '5' },
      file: { path: '/tmp/chunk.part' },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(service.uploadBackupImportChunk).toHaveBeenCalledWith('session-1', '/tmp/chunk.part', 0, 5);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('completes chunked imports using the upload id', async () => {
    const service = {
      completeBackupImport: jest.fn().mockResolvedValue({ success: true, backup: { id: '1' }, selection: { requestedSections: [], includedSections: [], warnings: [] } }),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.completeImport({
      body: { uploadId: 'session-1' },
      user: { roles: ['admin'], permissions: ['*'] },
    } as any, res as any);

    expect(service.completeBackupImport).toHaveBeenCalledWith(expect.any(Object), 'session-1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects import requests without an uploaded backup file', async () => {
    const service = {
      importBackup: jest.fn(),
    } as any;
    const controller = new SystemBackupController(service);
    const res = createResponse();

    await controller.importBackup({ user: { roles: ['admin'], permissions: ['*'] } } as any, res as any);

    expect(service.importBackup).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'backup file is required.' });
  });
});

function createResponse() {
  const response: Record<string, jest.Mock> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    download: jest.fn().mockReturnThis(),
  };
  return response;
}