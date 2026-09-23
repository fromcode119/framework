import { describe, expect, it } from 'vitest';
import { HostResourceService } from '@core/management/host-resource-service';

/**
 * Disk size from `df -Pk`, in KiB whatever the filesystem.
 *
 * `statfs` through Node multiplies blocks by the preferred I/O size, which on a Docker Desktop bind mount
 * is 1 MiB over 4 KiB blocks — a 971 GB disk showed as 232 TB. These are real `df -Pk` lines.
 */
describe('reading df -Pk', () => {
  it('reads the Docker Desktop bind mount that statfs got 256x wrong', () => {
    const output = [
      'Filesystem           1024-blocks      Used Available Capacity Mounted on',
      '/run/host_mark/Users   971350180 821339856 150010324      85% /app/public/uploads',
    ].join('\n');

    const disk = HostResourceService.parseDf('/app/public/uploads', output) as any;
    expect(disk.totalBytes).toBe(971350180 * 1024);
    expect(disk.freeBytes).toBe(150010324 * 1024);
    expect(disk.usedBytes).toBe((971350180 - 150010324) * 1024);
  });

  it('copes with spaces in the filesystem name and in the mount path', () => {
    const output = [
      'Filesystem    1024-blocks  Used Available Capacity Mounted on',
      'map auto_home        1000   400       600      40% /Volumes/My Disk',
    ].join('\n');

    expect(HostResourceService.parseDf('/x', output)).toMatchObject({ totalBytes: 1000 * 1024, freeBytes: 600 * 1024 });
  });

  it('answers null for output it cannot read, so the caller falls back to statfs', () => {
    expect(HostResourceService.parseDf('/x', '')).toBeNull();
    expect(HostResourceService.parseDf('/x', 'df: /x: No such file or directory')).toBeNull();
  });
});
