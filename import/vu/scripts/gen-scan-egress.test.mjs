import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import test, { describe } from 'node:test';
import {
  complementCidrs,
  cidrToRange,
  FORBIDDEN_CIDRS,
  OUTPUT_PATH,
  renderTerraform,
} from './gen-scan-egress.mjs';

/**
 * The scan-egress complement (Task 98).
 *
 * The vectors are pinned: exactly 103 CIDRs, first `1.0.0.0/8`, last
 * `208.0.0.0/4`. The algebraic properties matter more than the count — the
 * union with the forbidden list must cover all 2^32 addresses EXACTLY (no
 * gap, no overlap), or a scan pod is either unreachable somewhere it should
 * scan or, much worse, able to reach 169.254.169.254.
 */

const TOTAL = 1n << 32n;

describe('gen-scan-egress — the pinned vectors', () => {
  const cidrs = complementCidrs();

  test('exactly 103 CIDRs', () => {
    assert.equal(cidrs.length, 103);
  });

  test('first is 1.0.0.0/8 and last is 208.0.0.0/4', () => {
    assert.equal(cidrs[0], '1.0.0.0/8');
    assert.equal(cidrs.at(-1), '208.0.0.0/4');
  });

  test('sorted, non-overlapping and maximally collapsed', () => {
    let previousEnd = null;
    for (const cidr of cidrs) {
      const { start, end } = cidrToRange(cidr);
      assert.ok(start < end, `${cidr} is empty`);
      if (previousEnd !== null) {
        // Adjacent blocks inside one gap TOUCH by construction (the greedy
        // decomposition tiles the gap); they must never overlap.
        assert.ok(start >= previousEnd, `${cidr} overlaps its predecessor`);
      }
      // Maximal alignment: each block is the largest aligned CIDR at its start
      // that fits before the next forbidden range — asserted structurally by
      // the exact count (103) and the coverage algebra below.
      const size = end - start;
      assert.equal(start % size, 0n, `${cidr} is not aligned`);
      previousEnd = end;
    }
    // Sorted by construction of the walk; assert the ordering explicitly.
    const starts = cidrs.map((cidr) => cidrToRange(cidr).start);
    assert.deepEqual(
      [...starts],
      [...starts].sort((a, b) => (a < b ? -1 : 1)),
    );
  });
});

describe('gen-scan-egress — the algebra', () => {
  const cidrs = complementCidrs();
  const allowed = cidrs.map(cidrToRange);
  const forbidden = FORBIDDEN_CIDRS.map(cidrToRange);

  test('no allowed CIDR overlaps a forbidden range', () => {
    for (const a of allowed) {
      for (const f of forbidden) {
        const overlaps = a.start < f.end && f.start < a.end;
        assert.ok(!overlaps, `overlap between ${a.start}-${a.end} and ${f.start}-${f.end}`);
      }
    }
  });

  test('forbidden ∪ allowed covers every address exactly once', () => {
    const tagged = [
      ...forbidden.map((range) => ({ ...range, isForbidden: true })),
      ...allowed.map((range) => ({ ...range, isForbidden: false })),
    ].sort((x, y) => (x.start < y.start ? -1 : 1));
    // Merge-touching ranges and walk: the union must tile [0, 2^32) with no
    // gap, and only FORBIDDEN ranges may touch each other.
    const merged = [];
    for (const range of tagged) {
      const last = merged.at(-1);
      if (last !== undefined && range.start < last.end) {
        // A TRUE overlap — legal only between two forbidden ranges.
        assert.ok(
          last.isForbidden && range.isForbidden,
          `an allowed range overlaps at ${range.start}`,
        );
        if (range.end > last.end) last.end = range.end;
        continue;
      }
      if (last !== undefined) {
        // start === last.end is the tiling touching itself; anything more is a gap.
        assert.equal(last.end, range.start, `gap before ${range.start}`);
      }
      merged.push({ ...range });
    }
    assert.equal(merged[0].start, 0n);
    assert.equal(merged.at(-1).end, TOTAL);
    // And the total measure adds up: |forbidden merged| + |allowed| = 2^32.
    const allowedSize = allowed.reduce((sum, range) => sum + (range.end - range.start), 0n);
    const forbiddenMerged = [];
    for (const range of [...forbidden].sort((x, y) => (x.start < y.start ? -1 : 1))) {
      const last = forbiddenMerged.at(-1);
      if (last !== undefined && range.start <= last.end) {
        // Touching forbidden ranges merge for the measure count.
        if (range.end > last.end) last.end = range.end;
        continue;
      }
      forbiddenMerged.push({ ...range });
    }
    const forbiddenSize = forbiddenMerged.reduce(
      (sum, range) => sum + (range.end - range.start),
      0n,
    );
    assert.equal(allowedSize + forbiddenSize, TOTAL);
  });

  test('the metadata address 169.254.169.254 is NOT allowed', () => {
    const imds = (169n << 24n) | (254n << 16n) | (169n << 8n) | 254n;
    for (const range of allowed) {
      assert.ok(!(range.start <= imds && imds < range.end), 'IMDS address leaked into egress');
    }
  });
});

describe('gen-scan-egress — the generated artefact', () => {
  test('the committed .tf matches a fresh generation', async () => {
    const committed = await readFile(OUTPUT_PATH, 'utf8');
    assert.equal(committed, renderTerraform(complementCidrs()));
    assert.match(committed, /GENERATED by scripts\/gen-scan-egress\.mjs/);
    assert.match(committed, /scan_egress_cidrs = \[/);
  });
});
