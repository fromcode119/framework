/**
 * The parts of `/system/frontend` that are the SITE's, not the caller's: the same for every visitor of
 * one site at one content revision, and the expensive part of the answer.
 */
export interface IFrontendMetadataParts {
  adminMetadata: any;
  publicSettings: Record<string, unknown>;
  pluginPublicSettings: Record<string, Record<string, any>>;
  ssrGenerationCap: number;
  ssrRenderMemoryMb: number;
  ssrRenderTimeoutMs: number;
}
