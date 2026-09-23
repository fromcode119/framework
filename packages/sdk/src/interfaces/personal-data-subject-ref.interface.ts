/** Who a DSAR is about, as a data-protection plugin resolves them. */
export interface IPersonalDataSubjectRef {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}
