import fs from 'fs';
import path from 'path';
import { StackCommand } from '@cli/services/stack/stack-command';
import { StackReleaseOrder } from '@cli/services/stack/stack-release-order';

/**
 * The releases the stack tool pulled itself, so it can take the old ones away again.
 *
 * One release is about 12 GB and several are published a day, so pulling them without removing any
 * fills the disk within a week. Only what is recorded here is ever removed — an image somebody pulled
 * by hand is theirs — and never by force, so docker refuses one that any container still uses.
 */
export class StackImageLedger {
  /** The newest releases that stay, so going back to the previous one costs no second pull. */
  static readonly KEEP = 2;

  private static readonly FILE = '.pulled.json';

  constructor(
    private readonly stacksRoot: string,
    private readonly run: typeof StackCommand.output = StackCommand.output,
  ) {}

  tags(): string[] {
    const file = path.join(this.stacksRoot, StackImageLedger.FILE);
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as string[]) : [];
  }

  record(tag: string): void {
    this.write([...this.tags(), tag]);
  }

  /** Removes the images of releases older than the newest ones that no stack names; answers which went. */
  async retire(images: readonly string[], inUse: ReadonlySet<string>): Promise<string[]> {
    const retired: string[] = [];
    for (const tag of StackReleaseOrder.releases(this.tags()).slice(StackImageLedger.KEEP)) {
      if (inUse.has(tag)) continue;

      const removed = await Promise.all(images.map((image) => this.remove(`${image}:${tag}`)));
      if (removed.every(Boolean)) retired.push(tag);
    }
    this.write(this.tags().filter((tag) => !retired.includes(tag)));
    return retired;
  }

  /** True when the image is gone afterwards, whether this removed it or it already was. */
  private async remove(reference: string): Promise<boolean> {
    if ((await this.run('docker', ['image', 'rm', reference])) !== null) return true;
    return (await this.run('docker', ['image', 'inspect', reference])) === null;
  }

  private write(tags: string[]): void {
    fs.mkdirSync(this.stacksRoot, { recursive: true });
    fs.writeFileSync(path.join(this.stacksRoot, StackImageLedger.FILE), `${JSON.stringify(StackReleaseOrder.releases(tags))}\n`);
  }
}
