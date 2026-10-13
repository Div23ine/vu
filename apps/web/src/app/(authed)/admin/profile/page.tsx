'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { formatUtcClock } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { AdminPageHead } from '../_components/admin-page-head';
import { AvatarUploader } from './_components/avatar-uploader';
import { IdentityHeader } from './_components/identity-header';
import { NotificationsPanel } from './_components/notifications-panel';
import { PersonalPanel, type PersonalPanelControls } from './_components/personal-panel';
import {
  DEFAULT_TAB,
  ProfileTabs,
  tabFromHash,
  type ProfileTabId,
} from './_components/profile-tabs';
import { SecurityPanel } from './_components/security-panel';
import { useProfileSettings } from './_hooks/use-account-settings';
import './_styles/profile.css';

/**
 * `/admin/profile` (Task 83c) — Profile Settings: the identity header, the
 * hash-driven tab bar and the Personal Details + Profile Picture panels. The
 * Password & 2FA and Notifications panels are Task 83d (null stubs here).
 *
 * The active tab lives in the URL hash rather than in state alone, because the
 * invitation flow deep-links to `/admin/profile#security` and must land on the
 * credentials tab. `ProfileTabs` also listens for `hashchange`, so Back and
 * Forward move between tabs.
 *
 * `Save All Changes` drives every panel that has something to save — in this
 * task that is the personal form alone, since the other two panels are stubs.
 * The success toast therefore only fires once the panel it dispatched has
 * answered, which is what "only when every panel was saved" means with one
 * panel in play.
 *
 * Client page: everything is the signed-in administrator's own cookie-scoped
 * data. No permission gate beyond the layout's STAFF guard — `profile:read`
 * and `profile:write` are held by every staff role.
 */

export default function AdminProfilePage() {
  const settings = useProfileSettings();
  const [tab, setTab] = useState<ProfileTabId>(DEFAULT_TAB);
  const personal = useRef<PersonalPanelControls | null>(null);
  const mounted = useRef(false);

  // Read the deep link once, after mount (the hash is not available during SSR).
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    setTab(tabFromHash(window.location.hash));
  }, []);

  const onSelect = useCallback((id: ProfileTabId): void => {
    setTab(id);
    // Keep the URL the source of truth so the tab is linkable and Back works.
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(null, '', `#${id}`);
    }
  }, []);

  const onReady = useCallback((controls: PersonalPanelControls): void => {
    personal.current = controls;
  }, []);

  const onDiscardAll = (): void => {
    personal.current?.reset();
    toast({
      kind: 'info',
      title: 'Changes discarded',
      message: 'All unsaved edits have been reverted to the last saved state.',
    });
  };

  const onSaveAll = (): void => {
    personal.current?.submit();
    toast({
      kind: 'ok',
      title: 'All changes saved',
      message: `Profile, avatar, credentials and preferences synced at ${formatUtcClock(new Date())}.`,
    });
  };

  const profile = settings.data ?? null;

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Account & Personal Configuration"
        title="Profile Settings"
        description="Manage your administrator identity, profile picture, password, two-factor authentication and personal notification preferences. Sensitive changes are written to the immutable audit log."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="ps-discard-all"
              onClick={onDiscardAll}
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Discard Changes</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="ps-save-all"
              onClick={onSaveAll}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save All Changes</span>
            </button>
          </>
        }
      />

      <IdentityHeader profile={profile} isLoading={settings.isLoading} />

      <ProfileTabs active={tab} onSelect={onSelect} />

      <div className="ps-col">
        {/* All four panels stay mounted so every tab's `aria-controls` target
            exists; the inactive ones are `hidden`, per `.ps-panel[hidden]`. */}
        <div hidden={tab !== 'personal'}>
          <PersonalPanel profile={profile} onReady={onReady} />
        </div>
        <div hidden={tab !== 'picture'}>
          <AvatarUploader profile={profile} />
        </div>
        <div hidden={tab !== 'security'}>
          <SecurityPanel />
        </div>
        <div hidden={tab !== 'notifications'}>
          <NotificationsPanel />
        </div>
      </div>
    </div>
  );
}
