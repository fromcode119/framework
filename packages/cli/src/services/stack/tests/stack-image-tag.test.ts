import { describe, expect, it } from 'vitest';
import { StackImageTag } from '@cli/services/stack/stack-image-tag';
import type { IStackReleases } from '@cli/services/stack/interfaces/stack-releases.interface';

describe('StackImageTag', () => {
  const images = ['registry/api', 'registry/admin'];
  const here = (tags: Record<string, string[]>) => StackImageTag.over(images, (image) => tags[image] ?? []);
  const old = () => here({ 'registry/api': ['v0.2.588', 'v0.2.572'], 'registry/admin': ['v0.2.588', 'v0.2.572'] });
  const registry = (published: string[], latest: string | null = published[0] ?? null): IStackReleases => ({
    isPublished: async (_images, tag) => published.includes(tag),
    latest: async () => latest,
  });

  it('runs on the worktree version when its images are all here, without asking the registry', async () => {
    const choice = await old().choose({ preferred: 'v0.2.588', template: null, releases: registry([]) });
    expect(choice).toEqual({ tag: 'v0.2.588', note: null });
  });

  it('takes a published worktree version that is not here yet', async () => {
    const choice = await old().choose({ preferred: 'v0.2.640', template: null, releases: registry(['v0.2.651', 'v0.2.640']) });
    expect(choice).toEqual({ tag: 'v0.2.640', note: null });
  });

  it('takes the latest release when only old images are here', async () => {
    const choice = await old().choose({ preferred: null, template: 'v0.2.588', releases: registry(['v0.2.651']) });
    expect(choice.tag).toBe('v0.2.651');
  });

  it('runs the latest release for a worktree version that has no images, and says so', async () => {
    const choice = await old().choose({ preferred: 'v0.2.652', template: null, releases: registry(['v0.2.651']) });
    expect(choice.tag).toBe('v0.2.651');
    expect(choice.note).toContain('no published images');
  });

  it('falls back to the template tag when the registry cannot be read, and says so', async () => {
    const choice = await old().choose({ preferred: null, template: 'v0.2.572', releases: registry([], null) });
    expect(choice.tag).toBe('v0.2.572');
    expect(choice.note).toContain('registry');
  });

  it('under --no-pull takes the newest complete tag here, ignoring one only some images have and `latest`', async () => {
    const tag = here({ 'registry/api': ['latest', 'v0.2.600', 'v0.2.588', 'v0.2.572'], 'registry/admin': ['latest', 'v0.2.588', 'v0.2.572'] });
    const choice = await tag.choose({ preferred: 'v0.2.606', template: null, releases: null });
    expect(choice.tag).toBe('v0.2.588');
    expect(choice.note).toContain('--no-pull');
  });

  it('takes an explicit tag as given', async () => {
    expect(await here({}).choose({ explicit: 'v0.2.999', preferred: 'v0.2.606', template: null, releases: null })).toEqual({ tag: 'v0.2.999', note: null });
  });

  it('refuses when no released image is here and nothing can be pulled', async () => {
    await expect(here({}).choose({ preferred: null, template: null, releases: null })).rejects.toThrow(/--tag/);
  });

  it('names the images that lack a tag', () => {
    expect(here({ 'registry/api': ['v1.0.0'] }).lacking('v1.0.0')).toEqual(['registry/admin']);
  });
});
