export interface IAssistantToolMetadata {
  category?: string;
  entity?: string;
  intentHints?: string[];
  filters?: string[];
  returns?: string[];
  examples?: string[];
  followupHints?: string[];
}
