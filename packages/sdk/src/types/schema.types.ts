export type Access = (args: { req: any; user: any }) => boolean | Promise<boolean> | Record<string, any>;

export type CandidateLookupOptions = {
  fields?: string[];
  scanLimit?: number;
};

export type UpsertByCandidatesOptions = CandidateLookupOptions & {
  idField?: string;
  updateWhere?: (record: any) => Record<string, any>;
};
