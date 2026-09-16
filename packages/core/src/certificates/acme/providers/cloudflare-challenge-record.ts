/** A DNS-01 challenge record this provider created, kept only long enough to remove it again. */
export class CloudflareChallengeRecord {
  constructor(
    readonly zoneId: string,
    readonly recordId: string,
  ) {}
}
