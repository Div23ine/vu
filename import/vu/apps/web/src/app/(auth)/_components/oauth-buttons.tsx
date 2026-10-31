'use client';

import { AppWindow, Chrome, Github } from 'lucide-react';
import { env } from '../../../env';
import '../_styles/auth.css';

/**
 * OAuth buttons — shared by login (this task) and signup .
 *
 * Clicking navigates the whole window to the API's provider-start endpoint
 * (a 302 to the provider — never a fetch), carrying the open-redirect-safe
 * `next` path through to the callback. The design's
 * `OAuth handshake would start here in production.` toast is replaced by the
 * real handshake.
 */

const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: Chrome },
  { id: 'github', label: 'GitHub', Icon: Github },
  { id: 'microsoft', label: 'Microsoft', Icon: AppWindow },
] as const;

export interface OAuthButtonsProps {
  /** Already sanitised by the caller (`safeNextPath`); defaults to `/`. */
  next?: string;
}

export function OAuthButtons({ next = '/' }: OAuthButtonsProps) {
  const start = (provider: string) => {
    window.location.assign(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/${provider}/start?next=${encodeURIComponent(next)}`,
    );
  };

  return (
    <div className="vv-social-grid" role="group" aria-label="Social sign in">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="vv-social-btn"
          data-vv-provider={label}
          onClick={() => start(id)}
        >
          <span className="vv-social-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="vv-social-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
