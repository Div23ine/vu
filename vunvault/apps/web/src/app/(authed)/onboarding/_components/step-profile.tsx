'use client';

import {
  CAREER_DESCRIPTIONS,
  CAREER_LABELS,
  ENTITY_DESCRIPTIONS,
  ENTITY_LABELS,
  type CareerRole,
  type EntityType,
} from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import type { StepPanelProps } from './step-personal';

/**
 * Step 2 — Career & account type (Task 64). Real `<input type="radio">`
 * groups inside `<fieldset><legend>` (the spec's semantics); the card IS the
 * label. Options and copy come straight from the contracts' label/description
 * records — nothing is written out by hand, so the wizard and the API enums
 * cannot drift. Required messages are the planner's copy, surfaced by the
 * wizard's form schema (see `onboarding-wizard.tsx`).
 */

const CAREER_ORDER = Object.keys(CAREER_LABELS) as CareerRole[];
const ENTITY_ORDER = Object.keys(ENTITY_LABELS) as EntityType[];

export function StepProfile({ form }: StepPanelProps) {
  const {
    register,
    formState: { errors },
  } = form;
  const step2 = errors.step2;

  return (
    <section className="ob-panel" data-step="2" aria-labelledby="obStep2Title">
      <div className="ob-panel-head">
        <div className="ob-panel-index">Step 02 — Career &amp; account type</div>
        <h2 className="ob-panel-title" id="obStep2Title" tabIndex={-1}>
          How do you use VUNVAULT?
        </h2>
        <p className="ob-panel-text">
          Your role determines the assessment templates, compliance mappings and reporting depth we
          prepare for you. Your entity type determines the contracting and invoicing path.
        </p>
      </div>
      <div className="ob-grid">
        <fieldset className="ob-field ob-span-2">
          <legend className="ob-label">
            Career / role <span aria-hidden="true">*</span>
          </legend>
          <div className="ob-radio-row">
            {CAREER_ORDER.map((career) => (
              <label key={career} className="ob-radio-card">
                <input type="radio" value={career} {...register('step2.career')} />
                <span className="ob-radio-body">
                  <span className="ob-radio-dot" aria-hidden="true" />
                  <span className="ob-radio-text">
                    <span className="ob-radio-title">{CAREER_LABELS[career]}</span>
                    <span className="ob-radio-sub">{CAREER_DESCRIPTIONS[career]}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <span
            className={cn('ob-err', step2?.career !== undefined && 'is-visible')}
            id="obCareerError"
            role="alert"
            aria-live="polite"
          >
            {step2?.career?.message}
          </span>
        </fieldset>

        <fieldset className="ob-field ob-span-2">
          <legend className="ob-label">
            Entity type <span aria-hidden="true">*</span>
          </legend>
          <div className="ob-radio-row ob-radio-row--three">
            {ENTITY_ORDER.map((entity) => (
              <label key={entity} className="ob-radio-card">
                <input type="radio" value={entity} {...register('step2.entity')} />
                <span className="ob-radio-body">
                  <span className="ob-radio-dot" aria-hidden="true" />
                  <span className="ob-radio-text">
                    <span className="ob-radio-title">{ENTITY_LABELS[entity]}</span>
                    <span className="ob-radio-sub">{ENTITY_DESCRIPTIONS[entity]}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <span
            className={cn('ob-err', step2?.entity !== undefined && 'is-visible')}
            id="obEntityError"
            role="alert"
            aria-live="polite"
          >
            {step2?.entity?.message}
          </span>
        </fieldset>
      </div>
    </section>
  );
}
