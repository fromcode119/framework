import { describe, expect, it } from 'vitest';
import { LazyExport } from '@sdk/lazy-export';

/** A class with statics, instances and state, loaded through a counter so the test sees WHEN. */
class Registry {
  static readonly created: string[] = [];
  constructor(readonly name: string) { Registry.created.push(name); }
  static lookup(name: string): string { return `found ${name} via ${this === Registry ? 'Registry' : 'something else'}`; }
  describe(): string { return `registry ${this.name}`; }
}

describe('LazyExport', () => {
  it('loads nothing until the export is first touched, then loads once', () => {
    let loads = 0;
    const Lazy = LazyExport.of(() => { loads += 1; return Registry; });
    expect(loads).toBe(0);
    expect(Lazy.lookup('cms')).toBe('found cms via something else');
    Lazy.lookup('seo');
    expect(loads).toBe(1);
  });

  it('behaves as the class: new, instance methods, instanceof and static state', () => {
    const Lazy = LazyExport.of(() => Registry);
    const instance = new Lazy('a');
    expect(instance.describe()).toBe('registry a');
    expect(instance).toBeInstanceOf(Registry);
    expect(instance).toBeInstanceOf(Lazy);
    expect(Lazy.created).toContain('a');
    expect('lookup' in Lazy).toBe(true);
  });
});
