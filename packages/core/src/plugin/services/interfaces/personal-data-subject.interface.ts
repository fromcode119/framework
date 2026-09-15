/** Who a framework-side erasure is about. Mirrors the privacy plugin's subject reference. */
export interface IPersonalDataSubject {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}
