/** Who an erasure or an export is about. */
export interface IPersonalDataSubject {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}
