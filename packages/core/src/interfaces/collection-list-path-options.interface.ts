
export interface ICollectionListPathOptions {
  limit?: number;
  search?: string;
  /** Scalar filters; the primitive union is inlined — a one-use alias is not worth a declaration. */
  filters?: Record<string, string | number | boolean | null | undefined>;
}
