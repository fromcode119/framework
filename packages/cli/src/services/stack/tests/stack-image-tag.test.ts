import { describe, expect, it } from 'vitest';
import { StackImageTag } from '@cli/services/stack/stack-image-tag';

describe('StackImageTag', () => {
  const images = ['registry/api', 'registry/admin'];
  const here = (tags: Record<string, string[]>) => StackImageTag.over(images, (image) => tags[image] ?? []);

  it('runs on the worktree version when its images are all here', () => {
    const tag = here({ 'registry/api': ['v0.2.606', 'v0.2.588'], 'registry/admin': ['v0.2.606', 'v0.2.588'] });
    expect(tag.choose(undefined, 'v0.2.606', 'v0.2.588')).toEqual({ tag: 'v0.2.606', note: null });
  });

  it('never pulls a missing worktree version: falls back to the template tag and says so', () => {
    const tag = here({ 'registry/api': ['v0.2.588', 'v0.2.572'], 'registry/admin': ['v0.2.588', 'v0.2.572'] });
    const choice = tag.choose(undefined, 'v0.2.606', 'v0.2.588');

    expect(choice.tag).toBe('v0.2.588');
    expect(choice.note).toContain('nothing is pulled');
  });

  it('falls back to the newest complete tag, ignoring one only some images have and `latest`', () => {
    const tag = here({ 'registry/api': ['latest', 'v0.2.600', 'v0.2.588', 'v0.2.572'], 'registry/admin': ['latest', 'v0.2.588', 'v0.2.572'] });
    expect(tag.choose(undefined, 'v0.2.606', null).tag).toBe('v0.2.588');
  });

  it('takes an explicit tag as given', () => {
    expect(here({}).choose('v0.2.999', 'v0.2.606', null)).toEqual({ tag: 'v0.2.999', note: null });
  });

  it('refuses rather than pulling when no released image is here at all', () => {
    expect(() => here({}).choose(undefined, 'v0.2.606', null)).toThrow(/Pull one on purpose/);
  });
});
