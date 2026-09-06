import type { ChildProcess } from 'child_process';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { LineSplitter } from '@core/process/line-splitter';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/** A guest that is our own forked child: IPC channel, same user, `kill` is a syscall away. */
export class ForkedGuestProcess implements IGuestProcess {
  readonly port: IMessagePort;
  readonly socketMode = 0o600;

  constructor(private readonly child: ChildProcess, readonly socketDir: string) {
    this.port = new IpcMessagePort(child);
  }

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  kill(signal: NodeJS.Signals = 'SIGKILL'): void {
    this.child.kill(signal);
  }

  onExit(listener: (code: number | null, signal: string | null) => void): void {
    this.child.on('exit', (code, signal) => listener(code, signal));
  }

  onOutput(listener: (stream: 'stdout' | 'stderr', line: string) => void): void {
    const out = new LineSplitter((line) => listener('stdout', line));
    const err = new LineSplitter((line) => listener('stderr', line));
    this.child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
    this.child.stderr?.on('data', (chunk: Buffer) => err.push(chunk));
    this.child.on('exit', () => { out.flush(); err.flush(); });
  }
}
