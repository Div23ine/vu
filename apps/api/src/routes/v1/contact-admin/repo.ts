import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { ContactCategory, ContactStatus } from '@vunvault/contracts';

/**
 * Admin contact-inbox and client-directory data access (Task 40f).
 *
 * Reads only what the views expose: the raw `ip_hash` column never leaves the
 * repository, and the assignee join yields `{ id, label }` (the profile's
 * name), not a profile row.
 */

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  category: ContactCategory;
  subject: string;
  message: string;
  status: ContactStatus;
  assignedToId: string | null;
  assignedToLabel: string | null;
  createdAt: string;
}

export interface ClientRow {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  clientCode: string | null;
  verifiedBlogger: boolean;
}

export interface ContactListQueryParams {
  page: number;
  pageSize: number;
  q?: string;
  status?: ContactStatus;
  category?: ContactCategory;
}

export interface ClientListQueryParams {
  page: number;
  pageSize: number;
  q?: string;
  verifiedBlogger?: boolean;
}

export interface ContactAdminRepo {
  listMessages(
    query: ContactListQueryParams,
  ): Promise<{ rows: ContactMessageRow[]; total: number }>;
  findMessage(id: string): Promise<ContactMessageRow | null>;
  /** Applies only the provided fields; returns the fresh row (with assignee label). */
  updateMessage(
    id: string,
    patch: { status?: ContactStatus; assignedTo?: string | null },
  ): Promise<ContactMessageRow | null>;
  /** An ACTIVE, non-deleted, non-client profile — the only valid assignee. */
  findStaffAssignee(id: string): Promise<{ id: string; label: string } | null>;
  listClients(query: ClientListQueryParams): Promise<{ rows: ClientRow[]; total: number }>;
}

const MESSAGE_COLUMNS = `
  select cm.id::text as id, cm.name, cm.email::text as email, cm.organization,
         cm.category::text as category, cm.subject, cm.message, cm.status::text as status,
         ap.id::text as assigned_to_id, ap.full_name as assigned_to_label,
         cm.created_at::text as created_at
  from contact_messages cm
  left join profiles ap on ap.id = cm.assigned_to`;

interface SqlContactRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  assigned_to_id: string | null;
  assigned_to_label: string | null;
  created_at: string;
}

interface SqlClientRow {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  client_code: string | null;
  verified_blogger: boolean;
}

function mapContactRow(row: SqlContactRow): ContactMessageRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    organization: row.organization,
    category: row.category as ContactCategory,
    subject: row.subject,
    message: row.message,
    status: row.status as ContactStatus,
    assignedToId: row.assigned_to_id,
    assignedToLabel: row.assigned_to_label,
    createdAt: row.created_at,
  };
}

export class SqlContactAdminRepo implements ContactAdminRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listMessages(
    query: ContactListQueryParams,
  ): Promise<{ rows: ContactMessageRow[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (fragment: string, value: unknown): void => {
      values.push(value);
      conditions.push(fragment.replace('?', `$${values.length}`));
    };

    if (query.q !== undefined && query.q !== '') {
      add(
        `(cm.name ilike ? or cm.email::text ilike ? or cm.organization ilike ? or cm.subject ilike ?)`,
        `%${query.q}%`,
      );
      values.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
    }
    if (query.status !== undefined) add('cm.status::text = ?', query.status);
    if (query.category !== undefined) add('cm.category::text = ?', query.category);

    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from contact_messages cm ${where}`,
      values,
    );
    const rows = await this.executor.unsafe<SqlContactRow[]>(
      `${MESSAGE_COLUMNS}
       ${where}
       order by cm.created_at desc, cm.id asc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, query.pageSize, offset],
    );
    return { rows: rows.map(mapContactRow), total: Number(totalRows[0]?.count ?? '0') };
  }

  async findMessage(id: string): Promise<ContactMessageRow | null> {
    const rows = await this.executor.unsafe<SqlContactRow[]>(
      `${MESSAGE_COLUMNS} where cm.id = $1::uuid limit 1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : mapContactRow(row);
  }

  async updateMessage(
    id: string,
    patch: { status?: ContactStatus; assignedTo?: string | null },
  ): Promise<ContactMessageRow | null> {
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [id];
    if (patch.status !== undefined) {
      values.push(patch.status);
      sets.push(`status = $${values.length}::contact_status`);
    }
    if (patch.assignedTo !== undefined) {
      values.push(patch.assignedTo);
      sets.push(`assigned_to = $${values.length}::uuid`);
    }
    await this.executor.unsafe(
      `update contact_messages set ${sets.join(', ')} where id = $1::uuid`,
      values,
    );
    return this.findMessage(id);
  }

  async findStaffAssignee(id: string): Promise<{ id: string; label: string } | null> {
    const rows = await this.executor.unsafe<Array<{ id: string; label: string }>>(
      `select p.id::text as id, p.full_name as label
       from profiles p
       where p.id = $1::uuid and p.role <> 'client'
         and p.account_status = 'active' and p.deleted_at is null
       limit 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listClients(query: ClientListQueryParams): Promise<{ rows: ClientRow[]; total: number }> {
    const conditions: string[] = ["p.role = 'client'", 'p.deleted_at is null'];
    const values: unknown[] = [];
    const add = (fragment: string, value: unknown): void => {
      values.push(value);
      conditions.push(fragment.replace('?', `$${values.length}`));
    };

    if (query.q !== undefined && query.q !== '') {
      add(
        `(p.full_name ilike ? or p.email::text ilike ? or o.name ilike ? or o.client_code ilike ?)`,
        `%${query.q}%`,
      );
      values.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
    }
    if (query.verifiedBlogger === true) conditions.push('p.verified_blogger_at is not null');
    if (query.verifiedBlogger === false) conditions.push('p.verified_blogger_at is null');

    const where = conditions.join(' and ');
    const offset = (query.page - 1) * query.pageSize;

    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count
       from profiles p left join organizations o on o.id = p.org_id
       where ${where}`,
      values,
    );
    const rows = await this.executor.unsafe<SqlClientRow[]>(
      `select p.id::text as id, p.full_name, p.email::text as email,
              o.name as company, o.client_code,
              (p.verified_blogger_at is not null) as verified_blogger
       from profiles p left join organizations o on o.id = p.org_id
       where ${where}
       order by p.full_name asc, p.id asc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, query.pageSize, offset],
    );
    return {
      rows: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        company: row.company,
        clientCode: row.client_code,
        verifiedBlogger: row.verified_blogger,
      })),
      total: Number(totalRows[0]?.count ?? '0'),
    };
  }
}
