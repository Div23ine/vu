import { Check, ListChecks } from 'lucide-react';
import type { StudioSubmitReadiness } from '@vunvault/contracts';
import { STUDIO_READINESS_LABELS, STUDIO_REQUIRED_READINESS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../../_styles/editor.css';

/**
 * Publication-readiness checklist — the dark card. Six items in
 * the contract's display order with the verbatim `STUDIO_READINESS_LABELS`;
 * the first three (`STUDIO_REQUIRED_READINESS`) carry the `Required` mark
 * and gate Submit. A `422 not_ready` response's readiness object lands in
 * `failed` and its false items get the `is-failed` highlight.
 */

interface ReadinessChecklistProps {
  readiness: StudioSubmitReadiness;
  failed: StudioSubmitReadiness | null;
}

const ORDER: Array<keyof StudioSubmitReadiness> = [
  'title',
  'category',
  'bodyWords',
  'excerpt',
  'featuredImage',
  'tags',
];

/** The contract's required tuple, widened for `keyof` lookups. */
const REQUIRED_KEYS: ReadonlySet<string> = new Set<string>(STUDIO_REQUIRED_READINESS);

export function ReadinessChecklist({ readiness, failed }: ReadinessChecklistProps) {
  return (
    <section className="vbg-card vbg-card--dark" aria-labelledby="vbgReadyHeading">
      <div className="vbg-card-head">
        <div>
          <h2 className="vbg-card-title" id="vbgReadyHeading">
            <ListChecks size={16} aria-hidden="true" />
            Publication Readiness
          </h2>
          <p className="vbg-card-note">
            Everything marked required must be complete before the post can be submitted.
          </p>
        </div>
      </div>
      <div className="vbg-card-body">
        <ul className="vbg-checklist">
          {ORDER.map((key) => {
            const done = readiness[key];
            const required = REQUIRED_KEYS.has(key);
            const isFailed = failed !== null && !failed[key];
            return (
              <li
                key={key}
                className={cn(
                  'vbg-check-item',
                  done ? 'is-done' : undefined,
                  isFailed ? 'is-failed' : undefined,
                )}
              >
                <span className="vbg-check-mark" aria-hidden="true">
                  <Check size={11} />
                </span>
                <span>{STUDIO_READINESS_LABELS[key]}</span>
                {required ? <span className="vbg-check-req">Required</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
