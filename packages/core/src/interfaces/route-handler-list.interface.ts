import type { RequestHandler } from 'express';
import type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';

/**
 * The handler list a `BaseRouter` route method accepts: express handlers, optionally preceded by a
 * single `{ access }` declaration that the router strips before wiring the fail-closed gate.
 *
 * An array contract has no class form, so it stays an `interface extends Array<…>`.
 */
export interface IRouteHandlerList extends Array<RequestHandler | IApiAccessDescriptor> {}
