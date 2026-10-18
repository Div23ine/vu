import '../_styles/auth.css';

/**
 * Generic auth card shell — the login card's chrome (an earlier iteration
 * classes, reproduced exactly: `vv-auth-card`, `vv-auth-head`, `vv-brand`,
 * `vv-brand-mark`, `vv-brand-name`, `vv-auth-title`, `vv-auth-sub`) around a
 * spec-specified title/sub, with the page-specific body as children.
 *
 * As a full page the card is `<main aria-labelledby>`, never `role="dialog"`
 * (an earlier iteration spec note for this card family). Directive-free on purpose: the
 * four route pages render it from client components, so it ships in their
 * bundle either way.
 */

export interface AuthCardProps {
  /** Card heading (verbatim spec copy, state-dependent). */
  title: string;
  /** Optional sub-line under the heading; may contain markup (`<strong>`). */
  sub?: React.ReactNode;
  children?: React.ReactNode;
}

export function AuthCard({ title, sub, children }: AuthCardProps) {
  return (
    <main className="vv-auth-card" id="vvAuthCard" aria-labelledby="vvAuthTitle">
      <header className="vv-auth-head">
        <span className="vv-brand">
          <span className="vv-brand-mark" aria-hidden="true">
            {/* The operator's static brand SVG, same source as the login card
         and the marketing header . */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" />
          </span>
          <span className="vv-brand-name">VUNVAULT</span>
        </span>
        <h1 className="vv-auth-title" id="vvAuthTitle">
          {title}
        </h1>
        {sub !== undefined ? <p className="vv-auth-sub">{sub}</p> : null}
      </header>
      {children}
    </main>
  );
}
