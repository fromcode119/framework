import { describe, expect, it, vi } from 'vitest';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';

/**
 * Page resolution asks every collection for a slug on each anonymous visit. A collection the visitor may
 * not read answered with an [ERROR] and a stack per request on production (broadcast lists/campaigns) —
 * an access refusal is the policy working, so it is logged at debug. A real failure stays an error.
 */
const controllerThrowing = (error: Error & { statusCode?: number }) => {
  const logger = { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() };
  const runtime: any = { logger, accessPolicy: { resolveReadConstraints: async () => { throw error; } } };
  return { controller: new RestReadController(runtime), logger };
};
const collection: any = { slug: 'fcp_example_lists', fields: [] };

describe('RestReadController logging', () => {
  it('an access refusal (401/403) is logged at debug, not as an error — and still rethrown to the caller', async () => {
    const refusal = Object.assign(new Error('Read access to collection "fcp_example_lists" requires permission.'), { statusCode: 401 });
    const { controller, logger } = controllerThrowing(refusal);
    await expect(controller.find(collection, { query: {} })).rejects.toBe(refusal);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('a real failure is still an error with its stack', async () => {
    const failure = new Error('database connection lost');
    const { controller, logger } = controllerThrowing(failure);
    await expect(controller.find(collection, { query: {} })).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('database connection lost'), expect.objectContaining({ stack: failure.stack }));
  });
});
