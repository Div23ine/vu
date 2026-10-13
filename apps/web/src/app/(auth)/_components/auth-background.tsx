import '../_styles/auth.css';

/**
 * Animated auth background (Task 59) — three drifting orbs, the perspective
 * grid and the scanline sweep, all purely decorative (`aria-hidden`). The
 * `prefers-reduced-motion` block in `auth.css` stops every animation.
 */
export function AuthBackground() {
  return (
    <div className="vv-auth-bg" aria-hidden="true">
      <span className="vv-orb vv-orb--1" />
      <span className="vv-orb vv-orb--2" />
      <span className="vv-orb vv-orb--3" />
      <span className="vv-auth-grid" />
      <span className="vv-auth-scanline" />
    </div>
  );
}
