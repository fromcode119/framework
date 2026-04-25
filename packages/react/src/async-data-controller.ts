import type { AsyncDataControllerCallbacks } from './async-data-controller.interfaces';

export class AsyncDataController<T> {
  private requestId = 0;

  async load(fetcher: () => Promise<T>, callbacks: AsyncDataControllerCallbacks<T>): Promise<void> {
    const nextRequestId = ++this.requestId;
    callbacks.onStart?.();

    try {
      const result = await fetcher();
      if (!this.isCurrentRequest(nextRequestId)) return;
      callbacks.onSuccess(result);
    } catch (error) {
      if (!this.isCurrentRequest(nextRequestId)) return;
      callbacks.onError?.(this.toError(error));
    }
  }

  cancel(): void {
    this.requestId += 1;
  }

  private isCurrentRequest(requestId: number): boolean {
    return requestId === this.requestId;
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
}
