### TASK 66 — Billing & Invoices page: subscription, payment method (provider-hosted card fields), invoice history, CSV, PDF

**Layer:** L8

**Prerequisites:** Task 32, Task 45, Task 42, Task 12, Task 11

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Billing & Invoices page: subscription, payment method (provider-hosted card fields), invoice history, CSV, PDF**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/billing`: current subscription card, payment-method card with an Edit dialog that uses Stripe-hosted card fields, a TanStack Table of invoices with status, PDF download and CSV export.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/billing/page.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/billing-hero.tsx`, `subscription-card.tsx`, `payment-method-card.tsx`, `invoice-table.tsx`, `edit-payment-dialog.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/stripe-card-fields.tsx` — Stripe Elements wrapper.
- `apps/web/src/app/(authed)/portal/billing/_hooks/use-billing.ts`
- `apps/web/src/app/(authed)/portal/billing/_styles/billing.css`
- `apps/web/src/lib/stripe.ts` — lazy `loadStripe` singleton.
- `apps/web/src/mocks/handlers/billing.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- MODIFY `apps/web/.env.example` — add the name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=`.
- MODIFY `apps/web/src/env.ts` — add optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `apps/web/src/app/(authed)/portal/billing/billing.test.tsx`

**Dependencies allowed:**
- `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- `@tanstack/react-table` is already provided through `@vunvault/ui`.

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

**Reference markup:**

##### Billing page body
```html
<main class="flex-1">
 <section class="pt-10 md:pt-14">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="max-w-3xl space-y-4">
    <span class="vbb-eyebrow">Billing & Account</span>
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">Billing & Invoices</h1>
    <p class="text-neutral-500 text-base sm:text-lg leading-relaxed">Manage your subscription, update your payment method and download historical invoices for every VUNVAULT engagement.</p>
   </div>
  </div>
 </section>
 <section class="pt-10 md:pt-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vbb-grid-2">
    <div class="vbb-plan">
     <div class="vbb-plan-glow" aria-hidden="true"></div>
     <div class="vbb-plan-head">
      <span class="vbb-plan-eyebrow">Current Subscription</span>
      <h2 class="vbb-plan-name">
       Enterprise Client
       <span class="vbb-plan-badge">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Active
       </span>
      </h2>
      <p class="vbb-plan-desc">Full-scope retainer protection with 24/7 attack-surface monitoring, quarterly penetration testing and a dedicated security architect.</p>
     </div>
     <div class="vbb-plan-metrics">
      <div>
       <div class="vbb-metric-label">Renews On</div>
       <div class="vbb-metric-value vbb-metric-value--light">14 Oct 2026</div>
      </div>
      [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Billing Cycle ¦ Monthly || Amount ¦ $2,499]
     </div>
     <div class="vbb-upgrade">
      <div class="vbb-upgrade-text">
       <div class="vbb-upgrade-title">Need more coverage?</div>
       <div class="vbb-upgrade-sub">Add continuous red-team emulation or expand your monitored asset count.</div>
      </div>
      <button type="button" class="vbb-btn vbb-btn--primary vbb-btn--sm">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Upgrade Plan</span>
      </button>
     </div>
    </div>
    <div class="vbb-card">
     <div class="vbb-card-head">
      <div class="vbb-card-title-row">
       <span class="vbb-card-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <div>
        <h2 class="vbb-card-title">Payment Method</h2>
        <p class="vbb-card-sub">Used for all recurring charges and one-off engagements.</p>
       </div>
      </div>
     </div>
     <div class="vbb-pay">
      <div class="vbb-credit-card">
       <div class="vbb-cc-top">
        <span class="vbb-cc-chip" aria-hidden="true"></span>
        <div class="vbb-cc-brand">
         <span class="vbb-cc-brand-name">Mastercard</span>
         <span class="vbb-cc-brand-dots" aria-hidden="true">
          <span></span>
          <span></span>
         </span>
        </div>
       </div>
       <div class="vbb-cc-number" id="vbb-cc-number">5412 •••• •••• 4290</div>
       <div class="vbb-cc-foot">
        <div class="vbb-cc-block">
         <div class="vbb-cc-block-label">Card Holder</div>
         <div class="vbb-cc-block-value" id="vbb-cc-holder">JANE WANJIRU</div>
        </div>
        <div class="vbb-cc-block">
         <div class="vbb-cc-block-label">Expires</div>
         <div class="vbb-cc-block-value" id="vbb-cc-expiry">09 / 2028</div>
        </div>
       </div>
      </div>
      <div class="vbb-pay-actions">
       <button type="button" class="vbb-btn vbb-btn--dark" aria-controls="editPaymentModal">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Edit Payment Method</span>
       </button>
      </div>
      <p class="vbb-pay-note">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Card details are tokenised and stored by our PCI-DSS compliant payment processor.
      </p>
     </div>
    </div>
   </div>
  </div>
 </section>
 <section class="pt-12 md:pt-16 pb-16 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vbb-section-head">
    <div>
     <h2 class="vbb-section-title">Invoice History</h2>
     <p class="vbb-section-sub">Every engagement, subscription charge and Academy purchase. All invoices are available as signed PDFs for your finance and audit records.</p>
    </div>
    <button type="button" class="vbb-btn vbb-btn--ghost" id="vbb-export-all">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Export All (CSV)</span>
    </button>
   </div>
   <div class="vbb-table-wrap">
    <table class="vbb-table">
     <caption class="sr-only">Invoice history for Acme Fintech Ltd</caption>
     <thead>
      <tr>
       <th>Order / Invoice ID</th>
       <th>Date</th>
       <th>Service Description</th>
       <th>Amount</th>
       <th>Status</th>
       <th>Action</th>
      </tr>
     </thead>
     <tbody id="vbb-invoice-body">
      <tr class="vbb-row">
       <td>
        <span class="vbb-inv-id">VV-INV-2026-0841</span>
       </td>
       <td>
        <span class="vbb-inv-date">18 Aug 2026</span>
       </td>
       <td>
        <span class="vbb-inv-service">Full Scope API PenTest</span>
        <span class="vbb-inv-service-detail">Enterprise Retainer · 12 endpoints · retest included</span>
       </td>
       <td>
        <span class="vbb-inv-amount">$2,499.00</span>
       </td>
       <td>
        <span class="vbb-status vbb-status--paid">
         <span class="vbb-status-dot" aria-hidden="true"></span>
         Paid
        </span>
       </td>
       <td class="vbb-cell-actions">
        <button type="button" class="vbb-dl">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         <span>Download PDF</span>
        </button>
       </td>
      </tr>
      [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: VV-INV-2026-0720 ¦ 18 Jul 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0613 ¦ 18 Jun 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0511 ¦ 12 May 2026 ¦ VUNVAULT Academy — Team Subscription ¦ 12 seats · SOC Analyst & Red Team tracks · annual ¦ $1,440.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0488 ¦ 02 May 2026 ¦ Mobile App PenTest — iOS & Android ¦ M-Pesa gateway integration review · one-off engagement ¦ $899.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0902 ¦ 18 Sep 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Pending ¦ Awaiting Payment]
     </tbody>
    </table>
   </div>
   <div class="vbb-table-foot">
    <p class="vbb-table-foot-note">
     Showing the last 6 transactions. Invoices are retained for 7 years for audit purposes. For billing queries contact
     <strong>billing@vunvault.com</strong>
     .
    </p>
    <div class="vbb-pay-actions">
     <a href="/contact" class="vbb-btn vbb-btn--ghost vbb-btn--sm">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Billing Support</span>
     </a>
    </div>
   </div>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vbb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vbb-btn svg { transition: transform 0.22s var(--ease); }
.vbb-btn:active { transform: translateY(0) scale(0.98); }
.vbb-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vbb-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vbb-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vbb-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vbb-btn--dark { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 16px 34px -18px var(--brand-glow); }
.vbb-btn--dark:hover { transform: translateY(-2px); filter: brightness(1.07); }
.vbb-btn--sm { padding: 9px 16px; font-size: 0.72rem; }
.vbb-eyebrow { display: inline-block; padding: 6px 14px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.vbb-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.vbb-section-title { font-size: clamp(1.4rem, 2.8vw, 1.85rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--ink); }
.vbb-section-sub { margin-top: 6px; max-width: 62ch; font-size: 0.82rem; line-height: 1.7; color: var(--ink-muted); }
.vbb-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vbb-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vbb-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vbb-card-title-row { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
.vbb-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vbb-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vbb-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vbb-grid-2 { display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px; align-items: stretch; }
.vbb-plan { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 24px; padding: 30px 32px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vbb-plan-glow { position: absolute; top: -45%; right: -8%; width: 46%; height: 190%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vbb-plan-head { position: relative; z-index: 1; }
.vbb-plan-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vbb-plan-name { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: clamp(1.4rem, 3vw, 1.95rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: #ffffff; }
.vbb-plan-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); box-shadow: 0 10px 22px -14px var(--brand-glow); }
.vbb-plan-desc { margin-top: 12px; max-width: 52ch; font-size: 0.82rem; line-height: 1.7; color: #9aa8ba; }
.vbb-plan-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding-top: 22px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.vbb-metric-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; white-space: nowrap; }
.vbb-metric-value { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand); text-shadow: 0 0 22px var(--brand-glow); line-height: 1; }
.vbb-metric-value--light { color: #ffffff; text-shadow: none; }
.vbb-upgrade { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: var(--r-lg); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
.vbb-upgrade-text { min-width: 0; }
.vbb-upgrade-title { font-size: 0.82rem; font-weight: 800; color: #ffffff; }
.vbb-upgrade-sub { margin-top: 4px; font-size: 0.72rem; line-height: 1.55; color: #93a2b5; }
.vbb-pay { display: flex; flex-direction: column; gap: 18px; }
.vbb-credit-card { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; min-height: 200px; padding: 24px 26px; border-radius: var(--r-xl); color: #ffffff; background: radial-gradient(120% 120% at 90% 0%, rgba(59, 153, 252, 0.35), transparent 58%), linear-gradient(150deg, #10151d 0%, #05070a 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 22px 46px -30px rgba(0, 0, 0, 0.65); }
.vbb-credit-card::after { content: ""; position: absolute; right: -40px; bottom: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(closest-side, rgba(59, 153, 252, 0.25), transparent 70%); pointer-events: none; }
.vbb-cc-top { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.vbb-cc-chip { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, #d4a24c, #a97c2e); border: 1px solid rgba(255, 255, 255, 0.25); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
.vbb-cc-chip::before { content: ""; width: 18px; height: 12px; border-radius: 3px; background: repeating-linear-gradient( 90deg, rgba(0, 0, 0, 0.35) 0 2px, transparent 2px 5px ); }
.vbb-cc-brand { display: flex; align-items: center; gap: 10px; }
.vbb-cc-brand-name { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #d6dde8; }
.vbb-cc-brand-dots { display: inline-flex; }
.vbb-cc-brand-dots span { width: 16px; height: 16px; border-radius: 50%; display: block; }
.vbb-cc-brand-dots span:first-child { background: rgba(244, 63, 94, 0.85); }
.vbb-cc-brand-dots span:last-child { background: rgba(245, 158, 11, 0.85); margin-left: -8px; mix-blend-mode: screen; }
.vbb-cc-number { position: relative; z-index: 1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.14em; color: #ffffff; white-space: nowrap; }
.vbb-cc-foot { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
.vbb-cc-block { min-width: 0; }
.vbb-cc-block-label { font-size: 9px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #7d8b9e; }
.vbb-cc-block-value { margin-top: 4px; font-size: 0.8rem; font-weight: 700; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vbb-pay-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.vbb-pay-note { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; line-height: 1.55; color: var(--ink-faint); }
.vbb-pay-note svg { color: var(--ok); flex: 0 0 auto; }
.vbb-table-wrap { margin-top: 0; border-radius: var(--r-xl); border: 1px solid var(--line-soft); background: #ffffff; box-shadow: 0 22px 50px -40px rgba(10, 13, 18, 0.45); overflow-x: auto; -webkit-overflow-scrolling: touch; }
.vbb-table { width: 100%; min-width: 820px; border-collapse: collapse; font-size: 0.8rem; }
.vbb-table thead th { padding: 15px 18px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b7c4d4; background: linear-gradient(180deg, var(--dark), #070b11); border-bottom: 1px solid rgba(59, 153, 252, 0.24); white-space: nowrap; }
.vbb-table thead th:last-child { text-align: right; }
.vbb-table tbody td { padding: 16px 18px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.vbb-row { transition: background-color var(--dur) var(--ease); }
.vbb-row:nth-child(even) { background: #fbfcfd; }
.vbb-row:hover { background: var(--brand-tint); }
.vbb-row:last-child td { border-bottom: 0; }
.vbb-inv-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 700; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 7px; padding: 4px 9px; white-space: nowrap; }
.vbb-inv-date { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; color: var(--ink-soft); white-space: nowrap; }
.vbb-inv-service { display: block; font-weight: 700; color: var(--ink); font-size: 0.82rem; line-height: 1.4; }
.vbb-inv-service-detail { display: block; margin-top: 3px; font-size: 0.72rem; color: var(--ink-muted); line-height: 1.5; }
.vbb-inv-amount { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; font-weight: 800; color: var(--ink); white-space: nowrap; }
.vbb-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.vbb-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vbb-status--paid { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.vbb-status--pending .vbb-status-dot { animation: pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vbb-dl { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; font-size: 0.72rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); cursor: pointer; white-space: nowrap; transition: background-color 0.22s var(--ease), color 0.22s var(--ease), border-color 0.22s var(--ease), transform 0.22s var(--ease), box-shadow 0.22s var(--ease); }
.vbb-dl:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; transform: translateY(-1px); box-shadow: 0 12px 24px -14px var(--brand-glow); }
.vbb-dl:ac
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Edit Payment Method dialog (the prototype collects raw card fields — see the REQUIRED CHANGE below)
```html
<div id="editPaymentModal" class="vbb-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vbb-payment-title">
 <div class="vbb-modal-backdrop"></div>
 <div class="vbb-modal-card" role="document">
  <div class="vbb-modal-head">
   <div>
    <span class="vbb-eyebrow">Secure card update</span>
    <h2 id="vbb-payment-title" class="vbb-modal-title">Edit Payment Method</h2>
    <p class="vbb-modal-text">Update the card used for your Enterprise retainer and one-off engagements. Changes take effect on your next billing cycle.</p>
   </div>
   <button type="button" class="vbb-modal-close" aria-label="Close dialog">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <form id="vbb-payment-form">
   <div class="vbb-grid-form">
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-holder">Cardholder Name</label>
     <input id="pm-holder" name="holder" class="vbb-input" type="text" value="Jane Wanjiru" autocomplete="cc-name" required/>
    </div>
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-number">Card Number</label>
     <input id="pm-number" name="number" class="vbb-input" type="text" value="5412 3456 7890 4290" inputmode="numeric" autocomplete="cc-number" required/>
    </div>
    <div class="vbb-field">
     <label for="pm-expiry">Expiry (MM / YY)</label>
     <input id="pm-expiry" name="expiry" class="vbb-input" type="text" value="09 / 28" placeholder="MM / YY" inputmode="numeric" autocomplete="cc-exp" required/>
    </div>
    <div class="vbb-field">
     <label for="pm-cvc">CVC</label>
     <input id="pm-cvc" name="cvc" class="vbb-input" type="text" placeholder="•••" inputmode="numeric" autocomplete="cc-csc" maxlength="4" required/>
    </div>
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-country">Billing Country</label>
     <select id="pm-country" name="country" class="vbb-select">
      <option>Kenya</option>
      <option>Nigeria</option>
      <option>Ghana</option>
      <option>South Africa</option>
      <option>Uganda</option>
      <option>Tanzania</option>
      <option>Rwanda</option>
      <option>United Kingdom</option>
      <option>United States</option>
      <option>Other</option>
     </select>
    </div>
   </div>
   <div class="vbb-modal-actions">
    <p class="vbb-modal-note">Your card is tokenised immediately — VUNVAULT never stores raw card numbers.</p>
    <button type="button" class="vbb-btn vbb-btn--ghost">Cancel</button>
    <button type="submit" class="vbb-btn vbb-btn--primary" id="vbb-payment-save">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Card</span>
    </button>
   </div>
  </form>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vbb-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vbb-modal[hidden] { display: none !important; }
.vbb-modal.is-open { opacity: 1; }
.vbb-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vbb-modal-card { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(640px, 100%); max-height: 90vh; overflow-y: auto; padding: 30px 32px 32px; border-radius: var(--r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.08), transparent 55%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vbb-modal.is-open .vbb-modal-card { transform: translateY(0) scale(1); }
.vbb-modal-card::-webkit-scrollbar { width: 8px; }
.vbb-modal-card::-webkit-scrollbar-track { background: transparent; }
.vbb-modal-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vbb-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vbb-modal-title { margin-top: 12px; font-size: clamp(1.2rem, 2.6vw, 1.55rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; color: var(--ink); }
.vbb-modal-text { margin-top: 8px; max-width: 52ch; font-size: 0.8rem; line-height: 1.7; color: var(--ink-muted); }
.vbb-modal-close { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); cursor: pointer; transition: color 0.22s var(--ease), border-color 0.22s var(--ease), background-color 0.22s var(--ease), transform 0.22s var(--ease); }
.vbb-modal-close:hover { color: var(--critical); border-color: rgba(244, 63, 94, 0.35); background: rgba(244, 63, 94, 0.08); transform: rotate(90deg); }
.vbb-modal-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.vbb-modal-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.vbb-modal-note { margin-right: auto; font-size: 0.7rem; line-height: 1.5; color: var(--ink-faint); max-width: 32ch; }
.vbb-grid-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.vbb-col-span-2 { grid-column: span 2; }
.vbb-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vbb-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vbb-input,
    .vbb-select { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vbb-input::placeholder { color: var(--ink-faint); }
.vbb-input:focus,
    .vbb-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vbb-input.is-invalid,
    .vbb-select.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vbb-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 38px; cursor: pointer; }
@media (max-width: 768px) {
.vbb-modal-card { padding: 24px 20px 26px; }
.vbb-modal-actions { flex-direction: column-reverse; align-items: stretch; }
.vbb-modal-actions .vbb-btn { width: 100%; }
.vbb-modal-note { max-width: none; text-align: center; margin-right: 0; }
}
@media (max-width: 640px) {
.vbb-grid-form { grid-template-columns: 1fr; }
.vbb-col-span-2 { grid-column: a
```

**REQUIRED CHANGE — no raw card data touches VUNVAULT:** the prototype dialog has plain inputs for card number, expiry and CVC. Replace those three fields with Stripe Elements (`CardNumberElement`, `CardExpiryElement`, `CardCvcElement` from `@stripe/react-stripe-js`) styled to look like `.vbb-input` (pass `style`/`classes` using token colours read from `tokens` in `@vunvault/ui`). Keep `Cardholder Name` and `Billing Country` as normal fields (country options verbatim: Kenya, Nigeria, Ghana, South Africa, Uganda, Tanzania, Rwanda, United Kingdom, United States, Other → ISO codes KE NG GH ZA UG TZ RW GB US XX). The dialog note stays verbatim: `Your card is tokenised immediately — VUNVAULT never stores raw card numbers.` Submit (`Save Card`): `stripe.createPaymentMethod({ type: "card", card: cardNumberElement, billing_details: { name, address: { country } } })` → `PUT /api/v1/billing/payment-method { provider: "stripe", providerPaymentMethodToken: pm.id, cardholderName, billingCountry }`. Errors from Stripe are shown inline under the fields (Stripe's `error.message`); the prototype's `Please complete all card fields` becomes the inline message when the Element reports `complete: false`. Success toast verbatim: `Payment method updated` (+ message `Changes take effect on your next billing cycle.`). If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing the dialog shows `Card updates are temporarily unavailable.` (planner copy) and disables Save. **v1 scope note:** payment-method storage supports Stripe cards only; Paystack (M-Pesa, African cards, bank) is used per invoice at checkout (Task 66b), not as a stored method.

**Data:** `useSubscription()` (`GET /billing/subscription`, 404 → show the card state `No active subscription` with a link `Browse plans` → `/services#pricing`), `usePaymentMethod()` (`GET /billing/payment-method`; 404 → `No payment method on file` + `Add Payment Method` button opening the same dialog), `useInvoices({ page, pageSize: 10 })`. Subscription card: `Renews On` formatted `14 Oct 2026` (`formatLongDate`-style `DD Mon YYYY`), `Billing Cycle` `Monthly`/`Annual`, `Amount` via `formatUsdWhole` (e.g. `$2,499`). The `Upgrade Plan` button → toast `{ kind: "ok", title: "Upgrade requested", message: "Upgrade options will be emailed to you shortly" }` (message verbatim from the prototype; there is no upgrade endpoint — add `// TODO(backend-contract)`; do not call the API). Card number display: `<first digit group> •••• •••• <last4>` is not derivable (we only store last4) → render `•••• •••• •••• <last4>`; brand name from the API; expiry `MM / YYYY`; holder uppercase.
**Invoice table (TanStack Table via `DataTable`, Task 12):** columns `Order / Invoice ID`, `Date`, `Service Description` (title + detail line), `Amount` (`formatUsd`), `Status`, `Action`. Status chips: `paid` → `Paid` (`vbb-status--paid`), `pending` → `Awaiting Payment` (`vbb-status--pending`), `overdue` → `Overdue`, `void` → `Void`. Action: `Download PDF` for every invoice (`GET /billing/invoices/:id/pdf`; on `202 generating` show toast `Preparing your invoice…` (planner) and retry after 3 s up to 5 times; use a hidden `<a download>` with the blob URL, revoke it after) and, for `pending`/`overdue`, an extra `Pay Now` button that opens the Pay dialog of Task 66b (this task only dispatches `usePayDialog().open(invoice)`; create the tiny store in `apps/web/src/lib/pay-dialog-store.ts`). Query `?invoice=<id>` opens the Pay dialog for that invoice automatically (used by the Products purchase hand-off). `Export All (CSV)` → `GET /billing/invoices.csv` as a download named `vunvault-invoices.csv`; when the table is empty toast `{ kind: "warn", title: "No invoices to export", message: "There are no invoices on this account yet." }`; success toast title `Invoice history exported as CSV`. Empty table: `EmptyState` `No invoices yet` / `Invoices appear here after your first engagement or purchase.` (planner). Caption `Invoice history for <company name>`.

**Tests:** subscription card values and `$2,499`; payment card shows `•••• •••• •••• 4290`; table renders six invoices with the right chips and `$` formatting; `Download PDF` calls the endpoint; CSV export triggers a download; dialog: Stripe Elements are mocked (`vi.mock("@stripe/react-stripe-js")`), save calls `createPaymentMethod` then the PUT with the token and NEVER with a card number (assert the request body has no `number`/`cvc` keys).

---

**Data shape (TypeScript):**
```ts
// Subscription, PaymentMethodView, Invoice: see contracts (Task 20/32).
interface PayDialogState { invoice: Invoice | null; open(i: Invoice): void; close(): void }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/billing/subscription → 200 { data: Subscription } | 404 | 403 no_org
// GET  /api/v1/billing/payment-method → 200 { data: PaymentMethodView } | 404
// PUT  /api/v1/billing/payment-method body { provider: "stripe"; providerPaymentMethodToken: string; cardholderName: string; billingCountry: string(2) } → 200 { data: PaymentMethodView } | 422 payment_method_rejected
// GET  /api/v1/billing/invoices?page=&pageSize= → 200 { data: Invoice[]; total }
// GET  /api/v1/billing/invoices/:id/pdf → 200 application/pdf | 202 { data: { status: "generating" } } | 404
// GET  /api/v1/billing/invoices.csv → 200 text/csv
```

---

**Out of scope:**
- Do not collect or transmit raw card numbers, expiry or CVC.
- Do not build the Pay dialog (Task 66b).
- Do not implement Paystack stored methods.
- Do not use `localStorage`.

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
☐ Report at the end: `Task 66 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

