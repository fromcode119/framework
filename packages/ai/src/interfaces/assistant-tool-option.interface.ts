/**
 * A tool offered to the assistant, as presented in the tool picker.
 *
 * `metadata` came from a SECOND, divergent declaration of this same interface in `types.types.ts`;
 * whichever module a consumer imported decided whether the field existed. Reconciled to the superset.
 */
export interface IAssistantToolOption {
  tool: string;
  description?: string;
  readOnly?: boolean;
  metadata?: Record<string, unknown>;
}
