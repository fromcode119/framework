import { SystemBackupController } from '../src/controllers/system-backup-controller';

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
});

function createResponse() {
  const response: Record<string, jest.Mock> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    download: jest.fn().mockReturnThis(),
  };
  return response;
}