/** Builds the tar Docker's archive endpoint answers with, for the files given, under one folder. */
export class TarFixture {
  static build(folder: string, files: Map<string, Buffer>, extra: Array<{ name: string; type: string; body?: Buffer }> = []): Buffer {
    const blocks: Buffer[] = [TarFixture.header(`${folder}/`, '5', 0)];
    for (const [name, body] of files) blocks.push(...TarFixture.entry(`${folder}/${name}`, '0', body));
    for (const entry of extra) blocks.push(...TarFixture.entry(entry.name, entry.type, entry.body ?? Buffer.alloc(0)));
    return Buffer.concat([...blocks, Buffer.alloc(1024)]);
  }

  private static entry(name: string, type: string, body: Buffer): Buffer[] {
    const padded = Buffer.alloc(Math.ceil(body.length / 512) * 512);
    body.copy(padded);
    if (Buffer.byteLength(name) <= 100) return [TarFixture.header(name, type, body.length), padded];
    // A long name goes in a PAX record before the entry, as Go's archive/tar writes it.
    const record = `path=${name}\n`;
    let length = record.length + 3;
    while (`${length} ${record}`.length !== length) length += 1;
    const pax = Buffer.from(`${length} ${record}`);
    return [...TarFixture.entry('PaxHeaders/x', 'x', pax), TarFixture.header(name.slice(-90), type, body.length), padded];
  }

  private static header(name: string, type: string, size: number): Buffer {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write('0000644\0', 100);
    header.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
    header.write(type, 156);
    header.write('ustar\0', 257);
    return header;
  }
}
