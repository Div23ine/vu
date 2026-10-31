'use client';

import Link from 'next/link';
import { env } from '../../../../env';
import { useSession } from '../../../../lib/session';
import { useLogout } from '../../../../lib/use-logout';
import '../_styles/admin-chrome.css';

/**
 * Command Center footer — the audit-aware meta strip.
 *
 * Values per the spec: `System Build` and `Node Identifier` come from
 * the public env with the design's strings as defaults; the encryption
 * standard is the constant; the `Session Reference` is derived from the
 * session — `ADM-<YYYY>-<MMDD>-<first 4 hex of the session id, uppercased>`.
 * `SessionUser` carries no login timestamp, so the reference is dated with
 * the current render date (the session the reference describes is the live
 * one); the format itself is exact.
 *
 * The footer's `Sign Out` is the same `useLogout()` mutation as the header's.
 */

const ENCRYPTION_STANDARD = 'AES-256-GCM';

export function formatSessionReference(sessionId: string, date: Date): string {
  const year = String(date.getUTCFullYear());
  const monthDay =
    String(date.getUTCMonth() + 1).padStart(2, '0') + String(date.getUTCDate()).padStart(2, '0');
  return `ADM-${year}-${monthDay}-${sessionId.slice(0, 4).toUpperCase()}`;
}

export function AdminFooter() {
  const { user } = useSession();
  const logout = useLogout();

  const buildLabel = env.NEXT_PUBLIC_BUILD_LABEL ?? 'VUNVAULT Admin Core v4.2.1';
  const nodeLabel = env.NEXT_PUBLIC_NODE_LABEL ?? 'node-nbo-01 · NBO-CORE';
  const sessionReference = user === null ? '' : formatSessionReference(user.id, new Date());

  return (
    <footer className="adm-footer">
      <div className="adm-footer-inner">
        <dl className="adm-footer-meta">
          <div>
            <dt>System Build</dt>
            <dd>{buildLabel}</dd>
          </div>
          <div>
            <dt>Encryption Standard</dt>
            <dd>{ENCRYPTION_STANDARD}</dd>
          </div>
          <div>
            <dt>Node Identifier</dt>
            <dd>{nodeLabel}</dd>
          </div>
          <div>
            <dt>Session Reference</dt>
            <dd>{sessionReference}</dd>
          </div>
        </dl>
        <div className="adm-footer-bottom">
          <span>
            © 2026 VUNVAULT. All rights reserved. Administrative access is logged and audited.
          </span>
          <nav className="adm-footer-links" aria-label="Administrative footer">
            <Link href="/admin/audit">Audit Logs</Link>
            <Link href="/admin/profile">Profile Settings</Link>
            <Link href="/admin/users">Access Control</Link>
            <button type="button" onClick={() => logout.mutate()}>
              Sign Out
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
