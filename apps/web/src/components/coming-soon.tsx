import Link from 'next/link';
import { Button, Eyebrow } from '@vunvault/ui';

/**
 * ComingSoon (Task 74) — the shared placeholder for the routes the
 * navigation links to but that have no prototype yet. Planner-authored:
 * a centred column (the not-found page's shared layout) with `Eyebrow`,
 * the ink h1, the muted body and an optional CTA button.
 *
 * A `<section>`, not a `<main>`: both the portal and the marketing layouts
 * already own the page's `<main>`.
 */

export interface ComingSoonCta {
  label: string;
  href: string;
}

export interface ComingSoonProps {
  eyebrow: string;
  title: string;
  body: string;
  cta?: ComingSoonCta;
}

export function ComingSoon({ eyebrow, title, body, cta }: ComingSoonProps) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="max-w-md text-ink-muted">{body}</p>
      {cta ? (
        <Button asChild variant="primary">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : null}
    </section>
  );
}
