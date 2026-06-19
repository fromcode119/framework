/**
 * A flexible reference to the person who owns an address. At least one of `personId`, `userId`, or
 * `email` must resolve to (or, on upsert, create) a `people` row — a fully anonymous ref is rejected.
 */
export interface PeopleAddressRef {
  personId?: any;
  userId?: any;
  email?: string;
}
