export interface ITaskDependency {
  from: string; // subtask ID that must complete first
  to: string; // subtask ID that depends on 'from'
  reason: string;
}
