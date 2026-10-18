'use client';

import { useCallback } from 'react';
import { DownloadCloud, FilePlus2, History } from 'lucide-react';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { AdvisoryEditor, PublishControls, useAdvisoryEditor } from './_components/advisory-editor';
import { ClientPreview } from './_components/client-preview';
import { DraftsPanel } from './_components/drafts-panel';
import { RecentAdvisories } from './_components/recent-advisories';
import { ZdSummary } from './_components/zd-summary';
import './_styles/zero-day.css';

/**
 * `/admin/zero-day` — the Zero-Day Advisory Desk: the summary tiles,
 * the advisory editor (identifiers, severity + exploitation flags, headline,
 * affected scope, summary/remediation/references), the Publish Controls panel,
 * the open drafts, the live client-view preview and the recently published
 * table with its inline patch-status menu and retract flow.
 *
 * One `useAdvisoryEditor` controller is created here and handed to the three
 * components that read or write it — the editor card, Publish Controls and the
 * client preview — so the preview can never disagree with the form.
 *
 * Permissions: `intel:read` reaches the page, `intel:write` may draft and save
 * (and drive the patch-status menu), `intel:broadcast` alone sees the
 * Emergency Broadcast area. The API remains the authority on every request.
 *
 * Client page: every figure is cookie-authenticated API data.
 */

export default function AdminZeroDayPage() {
  const { user } = useSession();
  const canWrite = can(user, 'intel:write');
  const canBroadcast = can(user, 'intel:broadcast');
  const controller = useAdvisoryEditor();

  const onPreviewClientView = useCallback((): void => {
    toast({
      kind: 'info',
      title: 'Client view preview',
      message: 'Opening a read-only rendering of the advisory as clients would see it.',
    });
  }, []);

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Zero-Day Intelligence & Advisory Desk"
        title="Zero-Day Advisory Editor"
        description="Draft, review and broadcast zero-day advisories. Save work in progress as a draft, or raise an emergency broadcast that pushes the advisory to every affected client dashboard within seconds."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="zd-new-advisory"
              onClick={controller.clearEditor}
            >
              <FilePlus2 size={15} aria-hidden="true" />
              <span>New Advisory</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              id="zd-import-cve"
              disabled={controller.isImporting}
              onClick={controller.importFromNvd}
            >
              <DownloadCloud size={15} aria-hidden="true" />
              <span>Import From NVD</span>
            </button>
            {/* No broadcast-history endpoint exists yet; the button is the
        design's seam (the an earlier iteration `um-export-roster` precedent). */}
            <button type="button" className="adm-btn adm-btn-ghost" id="zd-view-history">
              <History size={15} aria-hidden="true" />
              <span>Broadcast History</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="zd-kpi-heading">
        <h2 id="zd-kpi-heading" className="sr-only">
          Zero-day intelligence indicators
        </h2>
        <ZdSummary />
      </section>

      <div className="zd-layout">
        <div className="zd-col">
          <AdvisoryEditor controller={controller} />
          <RecentAdvisories
            canWrite={canWrite}
            canBroadcast={canBroadcast}
            onEdit={controller.loadAdvisory}
            onRebroadcast={controller.requestRebroadcast}
          />
        </div>
        <aside className="zd-col" aria-label="Advisory publishing controls">
          <PublishControls
            controller={controller}
            canWrite={canWrite}
            canBroadcast={canBroadcast}
            onPreviewClientView={onPreviewClientView}
          />
          <DraftsPanel onSelectDraft={controller.loadDraftById} />
          <section className="adm-card" aria-labelledby="zd-preview-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="zd-preview-heading">
                  <FilePlus2 size={15} aria-hidden="true" />
                  Client Dashboard Preview
                </h2>
                <p className="adm-card-note">
                  Live rendering of how this advisory appears to clients.
                </p>
              </div>
            </div>
            <div className="adm-card-body">
              <ClientPreview
                cveId={controller.values.cveId}
                title={controller.values.title}
                severity={controller.values.severity}
                scope={controller.values.scope}
                disclosureDate={controller.values.disclosureDate}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
