import { describe, expect, it } from 'vitest';
import { LOG_MAX_BYTES, LogArchive, uploadLog } from './log-archive';

/**
 * Log-archive tests (Task 88).
 *
 * The property that matters most is the split between what is STORED and what is
 * COUNTED: once the 5 MB cap is hit the archive stops growing but the counters
 * keep going, because a completion report that claims fewer lines than the scan
 * produced would be a false statement to the client.
 */

describe('LogArchive', () => {
  it('joins appended lines with a newline', () => {
    const archive = new LogArchive();
    archive.append('one');
    archive.append('two');
    archive.append('three');
    expect(archive.render()).toBe('one\ntwo\nthree');
    expect(archive.lines).toBe(3);
  });

  it('counts the newline in the byte total', () => {
    const archive = new LogArchive();
    archive.append('abc');
    // 3 bytes + the joining newline.
    expect(archive.bytes).toBe(4);
  });

  it('caps the stored text at the contract limit', () => {
    expect(LOG_MAX_BYTES).toBe(5 * 1024 * 1024);
    const archive = new LogArchive(100);
    for (let index = 0; index < 50; index += 1) {
      archive.append('x'.repeat(20));
    }
    expect(archive.isTruncated).toBe(true);
    // Stored bytes stay inside the cap even though counting continued.
    expect(archive.render().length).toBeLessThanOrEqual(100);
    expect(archive.lines).toBe(50);
    expect(archive.bytes).toBeGreaterThan(100);
  });

  it('keeps counting after truncation', () => {
    // 3 bytes + the joining newline = 4, comfortably inside a 16-byte cap.
    const archive = new LogArchive(16);
    archive.append('abc');
    expect(archive.isTruncated).toBe(false);
    // Fill past the cap: each line costs its length + 1 for the newline.
    archive.append('defghijklmnop');
    expect(archive.isTruncated).toBe(true);
    const before = archive.lines;
    const storedBefore = archive.render();
    archive.append('and more');
    // Counting continues, storing does not.
    expect(archive.lines).toBe(before + 1);
    expect(archive.render()).toBe(storedBefore);
  });

  it('snapshot reports both the archive and the true totals', () => {
    const archive = new LogArchive(64);
    archive.append('alpha');
    archive.append('beta');
    const snapshot = archive.snapshot();
    expect(snapshot.text).toBe('alpha\nbeta');
    expect(snapshot.lineCount).toBe(2);
    expect(snapshot.truncated).toBe(false);
  });

  it('reset clears everything', () => {
    const archive = new LogArchive(16);
    archive.append('x'.repeat(40));
    expect(archive.isTruncated).toBe(true);
    archive.reset();
    expect(archive.isTruncated).toBe(false);
    expect(archive.lines).toBe(0);
    expect(archive.render()).toBe('');
  });
});

describe('uploadLog', () => {
  it('PUTs text/plain and reports success', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      uploadLog('https://storage.test/put?sig=1', 'line one\nline two', fakeFetch),
    ).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('PUT');
    expect((calls[0]?.init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    expect(calls[0]?.init.body).toBe('line one\nline two');
  });

  it('reports failure rather than throwing — a lost archive must not lose the scan', async () => {
    const notOk = (async () => new Response(null, { status: 403 })) as unknown as typeof fetch;
    await expect(uploadLog('https://storage.test/put', 'x', notOk)).resolves.toBe(false);

    const throwing = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(uploadLog('https://storage.test/put', 'x', throwing)).resolves.toBe(false);
  });
});
