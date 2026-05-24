import type { Collection } from './schema.interfaces';

export type Access = (args: { req: any; user: any }) => boolean | Promise<boolean> | Record<string, any>;

export type CandidateLookupOptions = {
  fields?: string[];
  scanLimit?: number;
};

export type UpsertByCandidatesOptions = CandidateLookupOptions & {
  idField?: string;
  updateWhere?: (record: any) => Record<string, any>;
};

export type DeepReadonly<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends readonly (infer U)[]
      ? readonly DeepReadonly<U>[]
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

export type CollectionInput = Collection | DeepReadonly<Collection>;
