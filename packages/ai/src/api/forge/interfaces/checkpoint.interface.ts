export interface ICheckpoint {
  id: string;
  title: string;
  afterSubtaskId: string;
  verificationCriteria: string;
  verificationScript?: string;
  savedState: Record<string, any>;
  timestamp: number;
  verified: boolean;
}
