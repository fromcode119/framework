/** Turns a stream's chunks into whole lines, so a guest's console output is logged one line at a time. */
export class LineSplitter {
  private pending = '';

  constructor(private readonly onLine: (line: string) => void) {}

  push(chunk: Buffer | string): void {
    this.pending += chunk.toString();
    let index = this.pending.indexOf('\n');
    while (index >= 0) {
      const line = this.pending.slice(0, index).replace(/\r$/, '');
      this.pending = this.pending.slice(index + 1);
      if (line.trim()) this.onLine(line);
      index = this.pending.indexOf('\n');
    }
  }

  flush(): void {
    if (this.pending.trim()) this.onLine(this.pending);
    this.pending = '';
  }
}
