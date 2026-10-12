'use client';

import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { ROLE_LABELS } from '@vunvault/contracts';
import { ResultCount } from '@vunvault/ui';
import '../_styles/users.css';

/**
 * Roster toolbar (Task 79) — search + the role/status/MFA selects, URL-driven
 * like the scan queue's. Option labels come from `ROLE_LABELS` (the six staff
 * roles) and the markup's status/MFA lists; the count line uses the shared
 * `ResultCount` (`Showing 10 of 24 members`).
 */

const STAFF_ROLE_VALUES = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
] as const;

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['pending_invite', 'Pending Invite'],
  ['suspended', 'Suspended'],
  ['dormant', 'Dormant'],
] as const;

export interface UsersToolbarValues {
  q: string;
  role: string;
  status: string;
  mfa: string;
}

interface UsersToolbarProps {
  values: UsersToolbarValues;
  shown: number;
  total: number;
  onChange(patch: Partial<UsersToolbarValues>): void;
  onReset(): void;
}

export function UsersToolbar({ values, shown, total, onChange, onReset }: UsersToolbarProps) {
  return (
    <section className="um-toolbar" aria-labelledby="um-filter-heading">
      <div className="um-toolbar-head">
        <h2 className="um-toolbar-title" id="um-filter-heading">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Search & Filter Roster
        </h2>
        <ResultCount shown={shown} total={total} noun="members" className="um-results" />
      </div>
      <div className="um-toolbar-grid">
        <div className="um-field">
          <label className="um-field-label" htmlFor="um-search">
            Search
          </label>
          <div className="um-input-wrap">
            <span className="um-input-icon" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              id="um-search"
              className="um-input"
              type="search"
              placeholder="Name, email, team or scope…"
              autoComplete="off"
              value={values.q}
              onChange={(event) => onChange({ q: event.target.value })}
            />
          </div>
        </div>

        <div className="um-field">
          <label className="um-field-label" htmlFor="um-role">
            Role
          </label>
          <select
            id="um-role"
            className="um-select"
            value={values.role}
            onChange={(event) => onChange({ role: event.target.value })}
          >
            <option value="">All roles</option>
            {STAFF_ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="um-field">
          <label className="um-field-label" htmlFor="um-status">
            Account Status
          </label>
          <select
            id="um-status"
            className="um-select"
            value={values.status}
            onChange={(event) => onChange({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="um-field">
          <label className="um-field-label" htmlFor="um-mfa">
            MFA
          </label>
          <select
            id="um-mfa"
            className="um-select"
            value={values.mfa}
            onChange={(event) => onChange({ mfa: event.target.value })}
          >
            <option value="">MFA — any</option>
            <option value="enrolled">Enrolled</option>
            <option value="not_enrolled">Not enrolled</option>
          </select>
        </div>

        <div className="um-toolbar-actions">
          <button type="button" className="um-clear-btn" id="um-clear-filters" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  );
}
