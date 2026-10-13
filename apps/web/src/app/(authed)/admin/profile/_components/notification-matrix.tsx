'use client';

import { Fragment } from 'react';
import type { ChannelToggles, NotificationPrefs } from '@vunvault/contracts';
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_EVENT_META,
  NOTIFICATION_GROUPS,
  NOTIFICATION_EVENT_ORDER,
} from '@vunvault/contracts';

/**
 * Notification channel matrix (Task 83d) — the 11 contract events grouped into
 * the contract's own four groups, crossed with the four channels.
 *
 * Titles, descriptions and group names come straight from
 * `NOTIFICATION_EVENT_META` and `NOTIFICATION_GROUPS`, so the matrix cannot
 * drift from what the API dispatches. Every cell is a REAL checkbox (not a
 * `aria-pressed` button) and carries the accessible name the spec mandates:
 * `<event title> — <channel>`, which is what makes an 11×4 grid navigable
 * without sight of the row header.
 *
 * The channel keys differ in case between the two contract records —
 * `NOTIFICATION_CHANNEL_LABELS` is keyed `in_app|email|sms|push` while
 * `ChannelToggles` fields are `inApp|email|sms|push` — so `CHANNEL_FIELDS` is
 * the single place that maps between them.
 */

type ChannelKey = keyof typeof NOTIFICATION_CHANNEL_LABELS;

const CHANNEL_KEYS = Object.keys(NOTIFICATION_CHANNEL_LABELS) as ChannelKey[];

/** `in_app` → the `ChannelToggles` field that stores it. */
const CHANNEL_FIELDS: Record<ChannelKey, keyof ChannelToggles> = {
  in_app: 'inApp',
  email: 'email',
  sms: 'sms',
  push: 'push',
};

export interface NotificationMatrixProps {
  events: NotificationPrefs['events'];
  disabled?: boolean;
  onToggle(event: (typeof NOTIFICATION_EVENT_ORDER)[number], channel: ChannelKey): void;
}

export function NotificationMatrix({
  events,
  disabled = false,
  onToggle,
}: NotificationMatrixProps) {
  return (
    <div className="ps-matrix-wrap">
      <table className="ps-matrix">
        <caption className="sr-only">Notification channel preferences per event category</caption>
        <thead>
          <tr>
            <th scope="col">Event Category</th>
            {CHANNEL_KEYS.map((channel) => (
              <th scope="col" key={channel} className="ps-matrix-channel">
                {NOTIFICATION_CHANNEL_LABELS[channel]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_GROUPS.map((group) => {
            const rows = NOTIFICATION_EVENT_ORDER.filter(
              (event) => NOTIFICATION_EVENT_META[event].group === group,
            );
            if (rows.length === 0) return null;
            return (
              <Fragment key={group}>
                <tr className="ps-matrix-group">
                  <th scope="colgroup" colSpan={CHANNEL_KEYS.length + 1}>
                    {group}
                  </th>
                </tr>
                {rows.map((event) => {
                  const meta = NOTIFICATION_EVENT_META[event];
                  const toggles = events[event];
                  return (
                    <tr className="ps-matrix-row" key={event}>
                      <th scope="row" className="ps-matrix-event">
                        <span className="ps-matrix-title">{meta.title}</span>
                        <span className="ps-matrix-desc">{meta.description}</span>
                      </th>
                      {CHANNEL_KEYS.map((channel) => (
                        <td className="ps-matrix-cell" key={channel}>
                          <input
                            type="checkbox"
                            className="ps-matrix-check"
                            aria-label={`${meta.title} — ${NOTIFICATION_CHANNEL_LABELS[channel]}`}
                            checked={toggles?.[CHANNEL_FIELDS[channel]] ?? false}
                            disabled={disabled}
                            onChange={() => onToggle(event, channel)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { ChannelKey };
export { CHANNEL_FIELDS };
