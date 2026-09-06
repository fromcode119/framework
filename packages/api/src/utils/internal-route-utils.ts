import { InternalServiceAuth, RouteConstants } from '@fromcode119/core';

/** Service-to-service routes under `/internal`, opened only by the shared secret (`InternalServiceAuth`). */
export class InternalRouteUtils {
  static isInternalPath(pathname: string): boolean {
    const path = String(pathname || '').replace(/\/+$/, '');
    return path.includes(`${RouteConstants.SEGMENTS.INTERNAL}/`) || path.endsWith(RouteConstants.SEGMENTS.INTERNAL);
  }

  static isAuthorizedInternal(req: any): boolean {
    if (!InternalRouteUtils.isInternalPath(String(req?.path || ''))) return false;
    return InternalServiceAuth.authorize(req?.headers?.[InternalServiceAuth.HEADER]);
  }
}
