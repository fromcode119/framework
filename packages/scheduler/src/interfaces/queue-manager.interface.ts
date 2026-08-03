export interface IQueueManager {
  addJob(queue: string, name: string, data: any, options?: any): Promise<any>;
}
