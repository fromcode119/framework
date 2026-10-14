/** One container swapped by an update, kept until the new version has proven itself so it can be put back. */
export interface IReplacedContainer {
  service: string;
  name: string;
  previousId: string;
  replacementId: string;
}
