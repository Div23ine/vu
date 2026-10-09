### TASK 66b — Pay invoice dialog: currency selection with locked FX quote, provider/channel choice, USD checkout

**Layer:** L8

**Prerequisites:** Task 33, Task 34, Task 66

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Pay invoice dialog: currency selection with locked FX quote, provider/channel choice, USD checkout**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Pay Now dialog that quotes a display currency, shows the locked local amount with a countdown, lets the client choose card (Stripe) or Paystack (M-Pesa / bank / African card), and charges the invoice in USD.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/billing/_components/pay-invoice-dialog.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/fx-quote-panel.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/payment-channel-picker.tsx`
- `apps/web/src/app/(authed)/portal/billing/_hooks/use-checkout.ts` — `useFxQuote`, `useCheckout`, `usePaymentAttempt`.
- `apps/web/src/app/(authed)/portal/billing/_styles/pay-dialog.css`
- MODIFY `apps/web/src/app/(authed)/portal/billing/page.tsx` — mount the dialog.
- MODIFY `apps/web/src/mocks/handlers/billing.ts` — add handlers.
- `apps/web/src/app/(authed)/portal/billing/pay-dialog.test.tsx`

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

**This dialog has no prototype; all copy below is planner-authored. Use the `Dialog` primitive (Task 11) and the styling language of the billing page (`vbb-modal`, `vbb-btn`, `vbb-input`, `vbb-status` — reuse the CSS already in `billing.css`).**

**Layout:** header eyebrow `Secure payment`, title `Pay invoice <number>`, text `Charged in US dollars (USD). Local currency is shown for reference only.` Body (top→bottom): (1) invoice summary row (service title, `Amount due` in USD via `formatUsd(outstandingUsdCents)`); (2) `Display currency` select: `USD — US Dollar`, `KES — Kenyan Shilling`, `NGN — Nigerian Naira`, `GHS — Ghanaian Cedi`, `ZAR — South African Rand` (default from the profile country: KE→KES, NG→NGN, GH→GHS, ZA→ZAR, else USD); (3) the **FX quote panel** (only when currency ≠ USD): shows `≈ <formatLocalDisplay(localMinor, currency)>`, the line `Rate locked: 1 USD = <rate> <CCY>` and a countdown `Quote valid for mm:ss`; at expiry it turns into `Quote expired` with a `Refresh quote` button; below it, always: `You will be charged <formatUsd> in USD. The local amount is an estimate based on the locked rate; your bank may apply its own conversion.`; (4) **channel picker** (radio cards, real radios): `Card` / `Visa, Mastercard — processed by Stripe`; `M-Pesa` / `Pay from your phone — processed by Paystack`; `Bank transfer` / `Pay by transfer — processed by Paystack`; (5) channel-specific area: Card → Stripe Elements (as in Task 66) or the saved default card choice (`Use saved Mastercard •••• 4290` radio); M-Pesa → phone number field (`Phone number`, placeholder `+254 7XX XXX XXX`, validated E.164) used only for the Paystack prompt; Bank transfer → no extra field; (6) footer: `Cancel`, primary `Pay <formatUsd>` (spinner while pending, disabled when a quote is required but expired).

**Flow:** `POST /billing/fx-quotes { invoiceId, displayCurrency }` on open and whenever the currency changes (skip for USD); `POST /billing/checkout { invoiceId, fxQuoteId?, provider, channel, providerPaymentMethodToken?, idempotencyKey }` where `idempotencyKey = crypto.randomUUID()` generated ONCE per dialog open (reuse it on retry so a double-click cannot double-charge). Provider/channel mapping: Card → `stripe`/`card`; M-Pesa → `paystack`/`mpesa`; Bank transfer → `paystack`/`bank_transfer`. Result handling: `status: "succeeded"` or `requires_action` with Stripe `clientSecret` → `stripe.confirmCardPayment(clientSecret)` then poll; `redirectUrl` (Paystack) → `window.location.assign(redirectUrl)` (the return URL is `/portal/billing?invoice=<id>&paid=1`); M-Pesa shows a waiting state `Check your phone and enter your M-Pesa PIN to approve the payment.` with a spinner. **Never trust the synchronous result for ledger state:** after any success path poll `GET /billing/invoices?page=1&pageSize=10` every 3 s for up to 60 s until the invoice is `paid`, then show the success state: title `Payment received`, text `Invoice <number> is paid. A receipt has been emailed to you.`, button `Done`; timeout → `We're confirming your payment. This can take a minute — you'll receive an email when it completes.` and close. Errors: `409 quote_expired` → refresh the quote and show `Your quote expired. We refreshed it — please review and pay again.`; `409 amount_changed` → same with `The amount due changed. Please review the new amount.`; `409 already_paid` → close + invalidate invoices; `422 channel_unavailable` → inline `This payment method is not available for this invoice right now. Choose another method.`; Stripe card errors → Stripe's message; network failure → toast `{ kind: "crit", title: "Payment not completed", message: "You have not been charged. Please try again." }` (only if no attempt id was returned).

**Hard rules:** the amount sent to any provider is always the server-derived USD amount; the UI never sends an amount. Local currency is display-only. No cryptocurrency. After success invalidate `queryKeys.billing.invoices(...)` and `queryKeys.billing.subscription()`.

**Tests (mock providers):** switching to KES requests a quote and shows the locked amount and the USD charge sentence; countdown reaching zero disables Pay and shows `Quote expired`; Card path calls checkout with `provider: "stripe", channel: "card"`; M-Pesa requires a valid phone and sends `paystack`/`mpesa`; the idempotency key is identical across two submit attempts in one dialog session; success polling flips to `Payment received`; 409 `quote_expired` refreshes the quote; the checkout request body contains NO amount field.

---

**Data shape (TypeScript):**
```ts
interface FxQuote { id: string; invoiceId: string; displayCurrency: "USD"|"KES"|"NGN"|"GHS"|"ZAR"; rateLocalPerUsd: string; usdCents: number; localMinor: number; lockedAt: string; expiresAt: string; settlementCurrency: "USD" }
interface CheckoutBody { invoiceId: string; fxQuoteId?: string; provider: "stripe" | "paystack"; channel: "card" | "mpesa" | "bank_transfer"; providerPaymentMethodToken?: string; idempotencyKey: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/billing/fx-quotes body { invoiceId; displayCurrency } → 201 { data: FxQuote } | 409 already_paid | 422 unsupported_currency | 502 fx_unavailable
// POST /api/v1/billing/checkout body CheckoutBody → 201|200 { data: { paymentAttemptId; status: "created"|"requires_action"|"succeeded"|"failed"; usdCents; settlementCurrency: "USD"; clientSecret?; redirectUrl? } } | 409 { error: "quote_expired"|"amount_changed"|"already_paid" } | 422 channel_unavailable
```

---

**Out of scope:**
- Do not charge or display any non-USD charge amount.
- Do not compute amounts client-side.
- Do not store card data.
- Do not build webhook handling (server side).

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
☐ Report at the end: `Task 66b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

