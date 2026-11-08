import type { ResolutionMatchKind } from '@api/services/helpers/enums/resolution-match-kind.enum';

/** One lookup a collection has for a path: its kind, the candidate value, and the query that asks for it. */
export interface IResolutionLookup {
  kind: ResolutionMatchKind;
  candidate: string;
  query: any;
}
