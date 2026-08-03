/** Express-shaped request handler — structural so core types stay framework-agnostic. */
export interface IPluginRequestHandler {
  (req: any, res: any, next?: (error?: unknown) => void): unknown;
}
