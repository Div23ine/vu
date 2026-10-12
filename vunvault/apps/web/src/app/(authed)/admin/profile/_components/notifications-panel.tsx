'use client';

import { useEffect, useState } from 'react';
import { Bell, RotateCcw, Save } from 'lucide-react';
import type { NotificationPrefs } from '@vunvault/contracts';
import {
  DEFAULT_CHANNEL_TOGGLES,
  NOTIFICATION_EVENT_ORDER,
  NotificationPrefs as NotificationPrefsSchema,
} from '@vunvault/contracts';
import { formatUtcClock, isApiError } from '@vunvault/lib';
import { EmptyState, Skeleton, toast } from '@vunvault/ui';
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '../_hooks/use-admin-security';
import {
  CHANNEL_FIELDS,
  NotificationMatrix,
  type ChannelKey,
} from './notification-matrix';
import { QuietHours } from './quiet-hours';

/**
 * Notification Preferences panel (Task 83d) — overwrites the Task 83c stub.
 *
 * The matrix and the quiet-hours window are LOCAL form state seeded from
 * `GET /account/notifications`, so `Reset to Defaults` and any tick are edits
 * only — nothing reaches the API until Save. That is the spec's rule, and it is
 * what makes the panel safe to experiment in: a mis-tick cannot silently
 * unsubscribe an administrator from a critical alert.
 *
 * `Reset to Defaults` applies the contract's own `DEFAULT_CHANNEL_TOGGLES`
 * (in-app + email on, sms + push off) to every event, rather than a copy of
 * those booleans, so the button and the API's fallback for a missing row stay
 * identical.
 *
 * The payload is validated with `NotificationPrefs` before it is sent, which is
 * where the quiet-hours `HH:MM` regex and the event record shape are enforced.
 */

/** Every event at the contract's defaults — the `Reset to Defaults` target. */
function defaultPrefs(current: NotificationPrefs | undefined): NotificationPrefs {
  const events = NOTIFICATION_EVENT_ORDER.reduce(
    (accumulator, event) => ({ ...accumulator, [event]: { ...DEFAULT_CHANNEL_TOGGLES } }),
    {} as NotificationPrefs['events'],
  );
  return { events, quietHours: current?.quietHours ?? { enabled: false, from: null, to: null } };
}

export function NotificationsPanel() {
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);

  // Seed once per fetched value; editing afterwards must not be overwritten by
  // a background refetch.
  useEffect(() => {
    if (prefs.data === undefined) return;
    setDraft(prefs.data);
  }, [prefs.data]);

  if (prefs.isLoading) {
    return (
      <section
        className="adm-card ps-panel"
        id="ps-panel-notifications"
        role="tabpanel"
        aria-labelledby="ps-tab-notifications"
        tabIndex={0}
        aria-busy="true"
      >
        <div className="adm-card-body">
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  }

  if (draft === null) {
    return (
      <section
        className="adm-card ps-panel"
        id="ps-panel-notifications"
        role="tabpanel"
        aria-labelledby="ps-tab-notifications"
        tabIndex={0}
      >
        <div className="adm-card-body">
          <EmptyState
            title="Preferences unavailable"
            action={
              <button
                type="button"
                className="adm-mini-btn"
                onClick={() => void prefs.refetch()}
              >
                Retry
              </button>
            }
          />
        </div>
      </section>
    );
  }

  const onToggle = (
    event: (typeof NOTIFICATION_EVENT_ORDER)[number],
    channel: ChannelKey,
  ): void => {
    setDraft((current) => {
      if (current === null) return current;
      const toggles = current.events[event] ?? { ...DEFAULT_CHANNEL_TOGGLES };
      const field = CHANNEL_FIELDS[channel];
      return {
        ...current,
        events: { ...current.events, [event]: { ...toggles, [field]: !toggles[field] } },
      };
    });
  };

  const onReset = (): void => {
    setDraft((current) => defaultPrefs(current ?? undefined));
    toast({
      kind: 'info',
      title: 'Notifications reset',
      message: 'Restored to VUNVAULT defaults.',
    });
  };

  const onSave = (): void => {
    const parsed = NotificationPrefsSchema.safeParse(draft);
    if (!parsed.success) {
      toast({
        kind: 'warn',
        title: 'Check your quiet hours',
        message: 'Use the 24-hour form HH:MM for both times.',
      });
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () =>
        toast({
          kind: 'ok',
          title: 'Notification preferences saved',
          message: `Channel matrix updated at ${formatUtcClock(new Date())}.`,
        }),
      onError: (error) =>
        toast({
          kind: 'crit',
          title: 'Could not save preferences',
          message: isApiError(error) ? error.message : 'Please try again.',
        }),
    });
  };

  return (
    <section
      className="adm-card ps-panel"
      id="ps-panel-notifications"
      role="tabpanel"
      aria-labelledby="ps-tab-notifications"
      tabIndex={0}
    >
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Bell size={15} aria-hidden="true" />
            Notification Preferences
          </h2>
          <p className="adm-card-note">
            Choose how and where VUNVAULT reaches you. Critical security alerts are always
            delivered regardless of these preferences.
          </p>
        </div>
        <span className="adm-tag">Personal</span>
      </div>

      <div className="adm-card-body ps-notifications-body">
        <span className="ps-panel-label">Notification channel preferences per event category</span>

        <NotificationMatrix
          events={draft.events}
          disabled={update.isPending}
          onToggle={onToggle}
        />

        <QuietHours
          value={draft.quietHours}
          disabled={update.isPending}
          onChange={(quietHours) => setDraft((current) => ({ ...(current ?? draft), quietHours }))}
        />

        <div className="ps-form-actions">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            disabled={update.isPending}
            onClick={onReset}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reset to Defaults</span>
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            id="ps-save-notifications"
            disabled={update.isPending}
            onClick={onSave}
          >
            <Save size={15} aria-hidden="true" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </section>
  );
}
