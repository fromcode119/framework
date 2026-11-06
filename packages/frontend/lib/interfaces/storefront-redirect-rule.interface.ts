/** A redirect rule the API matched for a path: where it goes, 308 vs 307, or gone for good (410). */
export interface IStorefrontRedirectRule {
  target: string;
  permanent: boolean;
  gone: boolean;
}
