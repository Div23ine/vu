'use client';

import { useState } from 'react';
import { Award, ShieldOff } from 'lucide-react';
import type { ClientDirectoryItem } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { useGrantBloggerBadge, useRevokeBloggerBadge } from '../_hooks/use-contact-admin';

/**
 * Verified-Blogger badge toggle (Task 83e).
 *
 * Both directions go through a confirmation dialog because the badge is not a
 * cosmetic flag: it grants Content Studio access, so granting it to the wrong
 * person publishes an authoring surface. The copy in each confirmation names
 * the person and the consequence.
 *
 * Rendered only with `users:manage` — without it the directory is read-only and
 * the `Action` column shows the chip alone, so a support engineer can triage a
 * verification request without being offered a button the API would refuse.
 */

export interface BadgeToggleProps {
  client: ClientDirectoryItem;
  canManage: boolean;
}

export function BadgeToggle({ client, canManage }: BadgeToggleProps) {
  const grant = useGrantBloggerBadge();
  const revoke = useRevokeBloggerBadge();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pending = grant.isPending || revoke.isPending;
  const granted = client.verifiedBlogger;

  const run = (): void => {
    const mutation = granted ? revoke : grant;
    mutation.mutate(client.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast(
          granted
            ? {
                kind: 'warn',
                title: 'Badge revoked',
                message: `${client.email} can no longer submit articles.`,
              }
            : {
                kind: 'ok',
                title: 'Badge granted',
                message: `${client.email} can now use the Content Studio.`,
              },
        );
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast({
          kind: 'crit',
          title: granted ? 'Could not revoke badge' : 'Could not grant badge',
          message: isApiError(error) ? error.message : 'Please try again.',
        });
      },
    });
  };

  if (!canManage) {
    return <span className="ct-badge-none">—</span>;
  }

  return (
    <>
      <button
        type="button"
        className={granted ? 'adm-mini-btn ct-badge-revoke' : 'adm-mini-btn ct-badge-grant'}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        {granted ? (
          <ShieldOff size={13} aria-hidden="true" />
        ) : (
          <Award size={13} aria-hidden="true" />
        )}
        {granted ? 'Revoke badge' : 'Grant badge'}
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogTitle>
            {granted ? 'Revoke Verified Blogger badge' : 'Grant Verified Blogger badge'}
          </DialogTitle>
          <DialogDescription>
            {granted
              ? `${client.fullName} (${client.email}) will lose access to the Content Studio and can no longer submit articles for review.`
              : `${client.fullName} (${client.email}) will be able to sign in to the Content Studio and submit articles for editorial review.`}
          </DialogDescription>
          <div className="ct-dialog-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost" disabled={pending}>
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className={granted ? 'adm-btn adm-btn-dark' : 'adm-btn adm-btn-primary'}
              disabled={pending}
              onClick={run}
            >
              {granted ? 'Revoke badge' : 'Grant badge'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
