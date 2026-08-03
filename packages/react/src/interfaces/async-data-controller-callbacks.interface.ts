export interface IAsyncDataControllerCallbacks <T> {
  onError?: (error: Error) => void;
  onStart?: () => void;
  onSuccess: (result: T) => void;
}
