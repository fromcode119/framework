export interface Message {
  type: string;
  payload: any;
  plugin?: string;
}
