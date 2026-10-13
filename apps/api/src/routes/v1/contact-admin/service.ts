import {
  CONTACT_CATEGORY_LABELS,
  type ClientDirectoryItem,
  type ContactMessageView,
  type ContactStatus,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import type {
  ClientListQueryParams,
  ContactAdminRepo,
  ContactListQueryParams,
  ContactMessageRow,
} from './repo';

/**
 * Contact-inbox and client-directory operations (Task 40f).
 *
 * Pure orchestration: the repository owns SQL, the route owns the envelope and
 * the audit wrapper. Triage validates the assignee BEFORE touching the row —
 * a client account, a suspended profile or an unknown id is a `422
 * invalid_assignee`, never a silent no-op.
 */

export interface TriageInput {
  status?: ContactStatus;
  assignedTo?: string | null;
}

function toView(row: ContactMessageRow): ContactMessageView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    organization: row.organization,
    category: row.category,
    categoryLabel: CONTACT_CATEGORY_LABELS[row.category],
    subject: row.subject,
    message: row.message,
    status: row.status,
    assignedTo:
      row.assignedToId === null
        ? null
        : { id: row.assignedToId, label: row.assignedToLabel ?? row.assignedToId },
    createdAt: row.createdAt,
  };
}

export class ContactAdminService {
  private readonly repo: ContactAdminRepo;

  constructor(deps: { repo: ContactAdminRepo }) {
    this.repo = deps.repo;
  }

  async listMessages(
    query: ContactListQueryParams,
  ): Promise<{ data: ContactMessageView[]; total: number }> {
    const { rows, total } = await this.repo.listMessages(query);
    return { data: rows.map(toView), total };
  }

  async triage(id: string, body: TriageInput): Promise<ContactMessageView> {
    const existing = await this.repo.findMessage(id);
    if (existing === null) {
      throw new HttpError(404, 'not_found', 'Contact message not found');
    }
    if (body.assignedTo !== undefined && body.assignedTo !== null) {
      const assignee = await this.repo.findStaffAssignee(body.assignedTo);
      if (assignee === null) {
        throw new HttpError(422, 'invalid_assignee', 'assignedTo must be an active staff member');
      }
    }
    const updated = await this.repo.updateMessage(id, body);
    if (updated === null) {
      throw new HttpError(404, 'not_found', 'Contact message not found');
    }
    return toView(updated);
  }

  async listClients(
    query: ClientListQueryParams,
  ): Promise<{ data: ClientDirectoryItem[]; total: number }> {
    const { rows, total } = await this.repo.listClients(query);
    return { data: rows, total };
  }
}
