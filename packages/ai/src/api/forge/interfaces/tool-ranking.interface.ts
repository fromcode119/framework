export interface IToolRanking {
  toolName: string;
  score: number; // 0-1
  relevance: number; // 0-1 relevance to task
  confidence: number; // 0-1 confidence in recommendation
  prerequisites: string[]; // Must execute these first
  reasoning: string; // Why this tool
  alternatives: string[]; // Similar tools to consider
}
