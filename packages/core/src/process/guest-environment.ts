/**
 * The environment a plugin guest starts with: nothing of the host's — no database URL, no secrets —
 * except how the C allocator behaves. `MALLOC_ARENA_MAX` is read by glibc as the process starts; a guest
 * without it grows an arena for every thread that allocates and keeps what was freed there, which on a
 * site with sixteen guests is the difference between fitting in the server's memory and not.
 */
export class GuestEnvironment {
  private static readonly PASSED = ['MALLOC_ARENA_MAX'] as const;

  static build(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: Record<string, string> = {};
    for (const key of GuestEnvironment.PASSED) {
      const value = source[key];
      if (value) env[key] = value;
    }
    // Typed loosely because the Next apps augment `ProcessEnv` with required keys.
    return env as NodeJS.ProcessEnv;
  }
}
