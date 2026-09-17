/** Who a DSAR is about, as the privacy plugin resolves them. */
export interface IPersonalDataSubjectRef {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}
