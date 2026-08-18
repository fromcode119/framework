import { describe, expect, it, vi } from 'vitest';
import { SystemLogRetentionService } from '@core/database/system-log-retention-service';

describe('SystemLogRetentionService', () => {
  const makeLogger = () => ({ info: vi.fn(), error: vi.fn() });

  it('treats an unreadable meta table as "no retention configured" instead of rejecting', async () => {
    const db = {
      findOne: vi.fn().mockRejectedValue(new Error('no such table: _system_meta')),
      count: vi.fn(),
      delete: vi.fn(),
    };
    const logger = makeLogger();

    const removed = await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(removed).toBe(0);
    expect(db.count).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('does not prune when the declared window is empty', async () => {
    const db = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn(),
      delete: vi.fn(),
    };
    const logger = makeLogger();

    const removed = await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(removed).toBe(0);
    expect(db.count).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('prunes rows older than the declared window', async () => {
    const db = {
      findOne: vi.fn().mockResolvedValue({ value: '30' }),
      count: vi.fn().mockResolvedValue(5),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const logger = makeLogger();

    const removed = await new SystemLogRetentionService(db, logger).pruneFromSettings();

    expect(removed).toBe(5);
    expect(db.delete).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledOnce();
  });
});
