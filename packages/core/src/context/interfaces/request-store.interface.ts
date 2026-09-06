export interface IRequestStore {
  locale: string;
  /**
   * The tenant this request belongs to.
   *
   * Absent means NO tenant — never "all tenants" and never a default. Resolved once per request
   * from the Host header; see ServerMiddlewareSetup.
   */
  tenantId?: string;
  [key: string]: any;
}
