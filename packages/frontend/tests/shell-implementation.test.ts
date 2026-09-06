import { describe, expect, it } from 'vitest';
import { ShellImplementation } from '@fromcode119/react/shell-implementation';

const Static = () => null;
const Lazy = () => null;
const Other = () => null;

describe('ShellImplementation', () => {
  it('lets the bridge lazy replace the static default until a boundary has read it', () => {
    const holder = new ShellImplementation();
    holder.provideDefault(Static);
    holder.replace(Lazy);
    expect(holder.component).toBe(Lazy);
  });

  it('pins the component once a boundary has mounted, so a mounted shell never gets a second type', () => {
    const holder = new ShellImplementation();
    holder.provideDefault(Static);
    expect(holder.component).toBe(Static);
    holder.replace(Lazy); // a read alone (a server render) does not pin
    expect(holder.component).toBe(Lazy);
    holder.pin();
    holder.replace(Other);
    expect(holder.component).toBe(Lazy);
  });

  it('never lets a later default override, and stays null until something is provided', () => {
    const holder = new ShellImplementation();
    expect(holder.component).toBeNull();
    holder.replace(Lazy);
    holder.provideDefault(Other);
    expect(holder.component).toBe(Lazy);
  });
});
