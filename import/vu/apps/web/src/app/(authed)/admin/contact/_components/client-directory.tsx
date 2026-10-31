'use client';

import type { ClientDirectoryItem } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { BadgeToggle } from './badge-toggle';

/**
 * Client directory — the table the Verified-Blogger badge is granted
 * from.
 *
 * Columns are the spec's: `Client`, `Email`, `Company`, `Client ID`,
 * `Verified Blogger` (a chip) and `Action`. `Client ID` renders the API's
 * `clientCode` and em-dashes when a row has none, rather than showing the
 * internal UUID — the code is the identifier a human quotes in a ticket.
 *
 * The whole tab is gated on `users:read` by the page; `users:manage` decides
 * only whether the Action column offers a button.
 */

export interface ClientDirectoryProps {
  clients: readonly ClientDirectoryItem[];
  isLoading: boolean;
  canManage: boolean;
  /** Set when the message dialog handed off a sender email to search for. */
  searchEmail: string | null;
}

export function ClientDirectory({
  clients,
  isLoading,
  canManage,
  searchEmail,
}: ClientDirectoryProps) {
  return (
    <section className="adm-card" aria-labelledby="ct-directory-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="ct-directory-heading">
            Client Directory
          </h2>
          <p className="adm-card-note">
            Every client account on the platform, with its Verified Blogger state. Granting the
            badge opens the Content Studio to that person.
          </p>
        </div>
        <span className="adm-tag">{clients.length} Clients</span>
      </div>

      {searchEmail === null ? null : (
        <div className="ct-handoff" role="status">
          Filtered to <strong>{searchEmail}</strong> from the verification request.
        </div>
      )}

      {isLoading ? (
        <div className="adm-card-body" aria-busy="true">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : clients.length === 0 ? (
        <div className="adm-card-body">
          <EmptyState
            title="No clients match this search"
            description="Clear the search to see the full client directory."
          />
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table ct-table">
            <caption className="sr-only">
              Client directory with company, client code and Verified Blogger state
            </caption>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Email</th>
                <th scope="col">Company</th>
                <th scope="col">Client ID</th>
                <th scope="col">Verified Blogger</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="ct-client-name">{client.fullName}</td>
                  <td className="ct-client-email">{client.email}</td>
                  <td>{client.company ?? '—'}</td>
                  <td className="adm-mono">{client.clientCode ?? '—'}</td>
                  <td>
                    <span
                      className={cn(
                        'adm-badge',
                        client.verifiedBlogger ? 'adm-badge--ok' : 'adm-badge--info',
                      )}
                    >
                      {client.verifiedBlogger ? 'Verified' : 'Not verified'}
                    </span>
                  </td>
                  <td>
                    <BadgeToggle client={client} canManage={canManage} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>
                  Badge changes are written to the audit log and take effect on the client&apos;s
                  next request.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
