/**
 * Route handler utilities for Express-based controllers.
 *
 * @example
 * export const myController = {
 *   getItems: RouteUtils.createHandler(async (req) => service.listItems(req.query)),
 * };
 */
export class RouteUtils {
  /**
   * Wrap an async Express route handler with a standard try/catch error boundary.
   * Catches known ApiError instances and unknown errors, returning consistent JSON.
   */
  static createHandler(
    fn: (req: any) => Promise<any>,
    options?: { errorLabel?: string }
  ): (req: any, res: any) => Promise<void> {
    const label = options?.errorLabel ?? 'API';
    return async (req: any, res: any) => {
      try {
        const payload = await fn(req);
        return res.json(payload);
      } catch (error: any) {
        const status = error?.statusCode ?? error?.status;
        if (typeof status === 'number' && status >= 400 && status < 600) {
          return res.status(status).json({ error: error.message });
        }
        console.error(`[${label}] Unhandled route error:`, error);
        return res.status(500).json({ error: error?.message || 'Internal server error' });
      }
    };
  }
}