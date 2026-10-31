import { Table2 } from 'lucide-react';
import type { Permission, UserRole } from '@vunvault/contracts';
import { ROLE_DESCRIPTIONS, ROLE_PERMISSIONS } from '@vunvault/contracts';
import '../_styles/users.css';

/**
 * Role permission matrix (replaces the an earlier iteration stub).
 *
 * GENERATED from the contract: every cell is
 * `ROLE_PERMISSIONS[role].includes(permission)` — nothing is hard-coded.
 * Column order and short headings are the markup's; the row labels map each
 * capability to its contract permission (the mapping is this file's only
 * judgement call — the contract ships machine keys, the reference shows
 * human labels). The build has no save endpoint for grants (an earlier iteration owns
 * permission editing), so the cells render read-only; `aria-label`s follow
 * the reference's `<Role> can/cannot <capability>` pattern and the Super
 * Administrator column is the immutable one per the note.
 */

const COLUMNS: Array<{ role: UserRole; heading: string }> = [
  { role: 'super_admin', heading: 'Super Admin' },
  { role: 'admin', heading: 'Admin' },
  { role: 'security_analyst', heading: 'Analyst' },
  { role: 'soc_operator', heading: 'Operator' },
  { role: 'compliance_auditor', heading: 'Auditor' },
  { role: 'support_engineer', heading: 'Support' },
];

const MATRIX_GROUPS: Array<{
  category: string;
  rows: Array<{ label: string; permission: Permission }>;
}> = [
  {
    category: 'Scan Operations',
    rows: [
      { label: 'Initiate system scan', permission: 'scans:create' },
      { label: 'Manage scan queue', permission: 'scans:read' },
      { label: 'Pause all workers', permission: 'scans:execute' },
    ],
  },
  {
    category: 'Review & Release',
    rows: [
      { label: 'Clear review gate', permission: 'scans:review' },
      { label: 'Release report to client', permission: 'scans:release' },
      { label: 'Revoke released report', permission: 'scans:release' },
    ],
  },
  {
    category: 'Zero-Day Advisory',
    rows: [
      { label: 'Draft advisory', permission: 'intel:write' },
      { label: 'Emergency broadcast', permission: 'intel:broadcast' },
    ],
  },
  {
    category: 'Identity & Administration',
    rows: [
      { label: 'Provision new members', permission: 'users:manage' },
      { label: 'Edit role permissions', permission: 'users:manage' },
      { label: 'Read audit logs', permission: 'audit:read' },
    ],
  },
  {
    category: 'Client Data',
    rows: [
      { label: 'View client assets', permission: 'billing:read' },
      { label: 'Export client evidence', permission: 'audit:verify' },
    ],
  },
];

export function RoleMatrix() {
  return (
    <section className="adm-card" aria-labelledby="um-matrix-heading" id="um-matrix-anchor">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="um-matrix-heading">
            <Table2 size={17} aria-hidden="true" />
            Role Permission Matrix
          </h2>
          <p className="adm-card-note">
            Toggle capability grants per role. Changes apply to every member holding that role after
            saving. Super Administrator permissions are immutable.
          </p>
        </div>
        <span className="adm-tag adm-tag--crit">Privileged Action</span>
      </div>
      <div className="adm-table-wrap">
        <table className="um-perm-matrix">
          <caption className="sr-only">Capability grants per role</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {COLUMNS.map((column) => (
                <th
                  scope="col"
                  key={column.role}
                  title={ROLE_DESCRIPTIONS[column.role]}
                  className="um-perm-role"
                >
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_GROUPS.flatMap((group) => [
              <tr className="um-perm-cat-row" key={group.category}>
                <td className="um-perm-cat" colSpan={COLUMNS.length + 1}>
                  {group.category}
                </td>
              </tr>,
              ...group.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {COLUMNS.map((column) => {
                    const granted = ROLE_PERMISSIONS[column.role].includes(row.permission);
                    const capability = `${row.label.charAt(0).toLowerCase()}${row.label.slice(1)}`;
                    return (
                      <td key={column.role}>
                        <input
                          type="checkbox"
                          className="um-check"
                          checked={granted}
                          disabled
                          aria-label={`${column.heading} ${granted ? 'can' : 'cannot'} ${capability}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <p className="adm-note um-matrix-note">
        Super Administrator capabilities are locked and cannot be modified. All other changes are
        audited.
      </p>
    </section>
  );
}
