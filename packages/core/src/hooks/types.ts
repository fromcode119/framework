export interface HookMessagingAdapter {
  publish(event: string, payload: any): Promise<void> | void;
  subscribe(callback: (event: string, payload: any) => void): Promise<void> | void;
}
