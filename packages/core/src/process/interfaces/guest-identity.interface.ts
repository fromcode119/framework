/** The OS user a guest process runs as. Honoured only when a privileged spawner exists (T5c). */
export interface IGuestIdentity {
  uid: number;
  gid: number;
}
