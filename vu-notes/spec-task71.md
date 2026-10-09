### TASK 71 — Content Studio A: badge gate and my-submissions list

**Layer:** L8

**Prerequisites:** Task 36, Task 45, Task 12

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Content Studio A: badge gate and my-submissions list**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Studio shell at `/portal/studio`: the Verified-Blogger gate and the list of the author's posts with status and reviewer notes, linking to the editor.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/studio/page.tsx`
- `apps/web/src/app/(authed)/portal/studio/_components/studio-gate.tsx`, `submissions-table.tsx`, `studio-header.tsx`
- `apps/web/src/app/(authed)/portal/studio/_hooks/use-studio.ts`
- `apps/web/src/app/(authed)/portal/studio/_styles/studio.css`
- `apps/web/src/mocks/handlers/studio.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/studio/studio-a.test.tsx`

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (denied card):**

##### Access-denied card (shown when the user lacks the Verified Blogger badge)
```html
<main class="vbg-denied" id="vbgDenied" hidden>
 <div class="vbg-denied-card">
  <div class="vbg-denied-glow" aria-hidden="true"></div>
  <span class="vbg-denied-icon" aria-hidden="true">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </span>
  <span class="vbg-denied-eyebrow">Access Restricted</span>
  <h1 class="vbg-denied-title">Verified Journalist / Blogger badge required</h1>
  <p class="vbg-denied-text">
   You need a
   <strong>Verified Journalist / Blogger Badge</strong>
   to publish content on VUNVAULT. This studio lets approved writers draft articles, attach media and submit posts into the pre-publication moderation queue. Unverified accounts cannot open it.
  </p>
  <ul class="vbg-denied-list">
   <li>
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>
     Submit a verification request through the Contact page using the
     <strong>Journalist / Blogger Profile Request</strong>
     category.
    </span>
   </li>
   [+2 more sibling <li> elements with the SAME structure as the one above; their text content in order: Our editorial team verifies your identity and publication history manually. || Once approved, this studio unlocks and your posts enter admin moderation before publishing.]
  </ul>
  <div class="vbg-denied-actions">
   <a href="/contact" class="vbg-btn vbg-btn--primary">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Request Verification</span>
   </a>
   <a href="/" class="vbg-btn vbg-btn--ghost">Back to Home</a>
   <button type="button" class="vbg-btn vbg-btn--quiet" id="vbgDemoGrant">Enable demo verification</button>
  </div>
  <p class="vbg-demo-note">
   Demo control — writes
   <code>isVerifiedBlogger = "true"</code>
   to this browser’s localStorage so the studio can be evaluated without a backend.
  </p>
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.vbg-denied { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 60px 20px 90px; }
.vbg-denied-card { position: relative; overflow: hidden; width: min(720px, 100%); padding: 44px 40px 40px; text-align: center; border-radius: var(--vg-r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.10), transparent 58%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -50px rgba(10, 13, 18, 0.55); }
.vbg-denied-glow { position: absolute; top: -55%; right: -12%; width: 48%; height: 200%; background: radial-gradient(closest-side, var(--vg-brand-glow), transparent 72%); filter: blur(72px); opacity: 0.35; pointer-events: none; }
.vbg-denied-icon { position: relative; z-index: 1; display: inline-grid; place-items: center; width: 76px; height: 76px; margin-bottom: 22px; border-radius: 50%; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); box-shadow: 0 0 0 10px rgba(59, 153, 252, 0.06); }
.vbg-denied-eyebrow { position: relative; z-index: 1; display: inline-block; padding: 6px 14px; font-size: 0.64rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); border-radius: var(--vg-r-full); }
.vbg-denied-title { position: relative; z-index: 1; margin: 18px 0 0; font-size: clamp(1.5rem, 3.4vw, 2.05rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; color: var(--vg-ink); }
.vbg-denied-text { position: relative; z-index: 1; margin: 14px auto 0; max-width: 54ch; font-size: 0.9rem; line-height: 1.75; color: var(--vg-ink-muted); }
.vbg-denied-list { position: relative; z-index: 1; display: grid; gap: 10px; margin: 26px 0 0; padding: 0; list-style: none; text-align: left; }
.vbg-denied-list li { display: flex; align-items: flex-start; gap: 11px; padding: 13px 15px; font-size: 0.79rem; line-height: 1.65; color: var(--vg-ink-soft); background: #f8fafc; border: 1px solid var(--vg-line-soft); border-radius: var(--vg-r-md); }
.vbg-denied-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--vg-brand); }
.vbg-denied-actions { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin-top: 30px; }
.vbg-demo-note { position: relative; z-index: 1; margin: 22px 0 0; font-size: 0.68rem; line-height: 1.6; color: var(--vg-ink-faint); }
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--vg-brand) 0%, var(--vg-brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--vg-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.vbg-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--vg-brand-glow); }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-btn--quiet { color: var(--vg-ink-muted); background: transparent; border-color: var(--vg-line); font-weight: 700; }
.vbg-btn--quiet:hover { color: var(--vg-ink); background: #f8fafc; border-color: #d4d7dd; }
@media (max-width: 760px) {
.vbg-actionbar .vbg-btn { flex: 1 1 auto; }
.vbg-modal-foot .vbg-btn { width: 100%; }
}
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Verified Blogger`
- `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`
- `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`
- `Investigative technology journalist covering East African cyber policy and digital rights.`
- `Demo verification granted`
- `Reloading the Content Studio…`
- `Industry Updates`
- `Slug locked — click to resume auto-updates`
- `Lock slug to stop auto-updates`
- `The URL will no longer follow the title.`
- `The URL will now follow the title again.`
- `Nothing selected`
- `Highlight some text first, then clear its formatting.`
- `Tag limit reached`
**Gate:** `GET /api/v1/studio/status` → if `verified` is false render the denied card with copy verbatim from the markup and REMOVE the prototype's `Demo verification` button (it faked the badge with `localStorage`; the badge is granted by an administrator after a Contact-page verification request — the card's call-to-action link goes to `/contact?category=journalist_blogger_profile_request#contact-form`). Verified users see the header chip `Verified Blogger` with the tooltip text `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`.
**My submissions:** `GET /studio/submissions` → `DataTable` with columns `Title` (or `Untitled article`), `Category` (`BLOG_CATEGORY_LABELS`), `Status` (`CONTENT_STATUS_LABELS` chips: draft/pending review/changes requested/approved/rejected/published/scheduled), `Updated`, `Action` (`Edit` for `draft`/`changes_requested`, `View` otherwise → editor in read-only mode). When `status = changes_requested` or `rejected` show the reviewer note under the title (`Reviewer note:` prefix, planner copy). Buttons: `New article` → `/portal/studio/edit/new`; empty state `No articles yet` / `Start a draft — it is saved to your account and reviewed before publication.`

**Tests:** unverified user sees the denied copy and no demo button; verified user sees the table; reviewer note shown for `changes_requested`; New article navigates.

---

**Data shape (TypeScript):**
```ts
// StudioItem, StudioStatus: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/studio/status → 200 { data: { verified; verifiedAt; displayName } }
// GET /api/v1/studio/submissions → 200 { data: StudioItem[]; total } | 403 badge_required
```

---

**Out of scope:**
- Do not build the editor (Task 72).
- Do not use `localStorage` or any demo-grant control.
- Do not grant badges from the UI.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 71 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

