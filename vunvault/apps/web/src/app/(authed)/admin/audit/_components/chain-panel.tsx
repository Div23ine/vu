'use client';

import { Archive, Blocks, Link2, ShieldCheck } from 'lucide-react';
import type { AuditEntryView, ChainStatus } from '@vunvault/contracts';
import { cn, formatUtcClock } from '@vunvault/lib';
import { Skeleton } from '@vunvault/ui';

/**
 * Cryptographic Chain panel (Task 83b) — the integrity side of the console.
 *
 * Every figure comes from `GET /admin/audit/chain`: the state tag, the total
 * entry count (which is also the chain height — the chain is append-only, so
 * height and total cannot diverge), the genesis date, the last verification
 * stamp and the mismatch count.
 *
 * `Latest Blocks` is derived from the trail already on screen rather than a
 * second endpoint: the newest five entries give the seq, the UTC clock and the
 * `0x<first 16>…<last 8>` digest the reference renders.
 *
 * `Export WORM Snapshot` is NOT an API action — snapshots are written by the
 * platform — so it renders disabled with the tooltip the spec mandates (the
 * plan's decision #5 pattern), rather than pretending to call something.
 */

/** The five newest blocks the panel lists. */
const LATEST_BLOCK_COUNT = 5;

/** `0x7f3a9c21d48b05e6…c9a1f0e2` — the reference's digest elision. */
export function shortDigest(hash: string): string {
  return `0x${hash.slice(0, 16)}…${hash.slice(-8)}`;
}

export interface ChainPanelProps {
  chain: ChainStatus | null;
  isLoading: boolean;
  /** Newest-first trail, used for the Latest Blocks list. */
  entries: readonly AuditEntryView[];
  isChecking: boolean;
  onRunIntegrityCheck(): void;
}

export function ChainPanel({
  chain,
  isLoading,
  entries,
  isChecking,
  onRunIntegrityCheck,
}: ChainPanelProps) {
  const intact = chain?.state !== 'broken';
  const countFormatter = new Intl.NumberFormat('en-US');

  return (
    <section className="adm-card adm-card--dark">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Link2 size={15} aria-hidden="true" />
            Cryptographic Chain
          </h2>
          <p className="adm-card-note">
            Append-only Merkle-linked log. Each entry commits to the hash of the previous.
          </p>
        </div>
        <span className={cn('adm-tag', intact ? 'adm-tag--ok' : 'adm-tag--crit')}>
          {chain === null ? '—' : intact ? 'Intact' : 'Broken'}
        </span>
      </div>
      <div className="adm-card-body al-panel">
        <div className="al-panel-section">
          <span className="al-panel-title">
            <ShieldCheck size={12} aria-hidden="true" />
            Chain State
          </span>
          {isLoading || chain === null ? (
            <div aria-busy="true">
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <>
              <div className="al-status-row">
                <span>Total entries</span>
                <strong>{countFormatter.format(chain.totalEntries)}</strong>
              </div>
              <div className="al-status-row">
                <span>Chain height</span>
                <strong>{countFormatter.format(chain.totalEntries)}</strong>
              </div>
              <div className="al-status-row">
                <span>Genesis block</span>
                <strong>{chain.genesisDate}</strong>
              </div>
              <div className="al-status-row">
                <span>Last verified</span>
                <strong id="al-last-verified">
                  {chain.lastVerifiedAt === null
                    ? '—'
                    : formatUtcClock(new Date(chain.lastVerifiedAt))}
                </strong>
              </div>
              <div className="al-status-row">
                <span>Hash mismatches</span>
                <strong>{countFormatter.format(chain.hashMismatches)}</strong>
              </div>
            </>
          )}
        </div>

        <div className="al-panel-section">
          <span className="al-panel-title">
            <Blocks size={12} aria-hidden="true" />
            Latest Blocks
          </span>
          {entries.length === 0 ? (
            <p className="al-panel-empty">No blocks in the current window.</p>
          ) : (
            <ul className="al-blocks">
              {entries.slice(0, LATEST_BLOCK_COUNT).map((entry) => (
                <li className="al-block" key={entry.id}>
                  <span className="al-block-seq">
                    #{countFormatter.format(entry.seq)}
                  </span>
                  <span className="al-block-time">{formatUtcClock(new Date(entry.createdAt))}</span>
                  <span className="al-block-hash">{shortDigest(entry.hash)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="al-panel-section">
          <div className="al-actions-stack">
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="al-integrity-check"
              disabled={isChecking}
              onClick={onRunIntegrityCheck}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Run Integrity Check</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              id="al-worm-snapshot"
              disabled
              title="Snapshots are written automatically by the platform."
            >
              <Archive size={15} aria-hidden="true" />
              <span>Export WORM Snapshot</span>
            </button>
          </div>
          <p className="al-action-note">
            Snapshot exports are signed and timestamped for regulatory submission.
          </p>
        </div>
      </div>
    </section>
  );
}
