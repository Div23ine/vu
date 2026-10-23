/**
 * Q&A knowledge base — the single source of truth for two surfaces.
 *
 * 1. The home page's "Questions buyers actually ask" section renders every
 *    entry flagged `home` (this is the old /pricing page's content, retired
 *    with the page: its FAQ, its per-plan deliverables and timelines, and its
 *    billing facts, re-cut as questions).
 * 2. Zura, the floating assistant (`zura/zura-widget.tsx`), matches visitor
 *    questions against `ZURA_KB` — every entry below plus the site-fact
 *    entries — and answers verbatim from this copy. Nothing here is
 *    invented: each answer reuses wording already published on the site
 *    (plans section, services pages, checkout, scanner dialog, contact).
 *
 * `keywords` are the phrases the matcher bonus-scores; keep them lowercase.
 */

export interface QaEntry {
  q: string;
  a: string;
  keywords: readonly string[];
  /** Rendered in the home page's Q&A section. */
  home: boolean;
}

export const ZURA_KB: readonly QaEntry[] = [
  {
    q: 'What is included in every engagement?',
    a: 'A written scope and rules of engagement before any testing, manual validation of every automated finding, a prioritised remediation plan, and a closing call with the assessor who did the work — not a salesperson. All plans also include a named engagement lead, encrypted report delivery and a post-remediation re-test window.',
    keywords: ['included', 'include', 'every engagement', 'scope', 'deliverable'],
    home: true,
  },
  {
    q: 'What do you need from us to start?',
    a: 'A technical contact, written authorisation for the scoped systems, and test-environment credentials where authenticated testing is in scope. Nothing leaves your estate without a signed scope.',
    keywords: ['need', 'require', 'access', 'credentials', 'authorisation'],
    home: true,
  },
  {
    q: 'How long does an engagement take?',
    a: 'Starter assessments run about two weeks door-to-door: fieldwork within 5 business days of kickoff, report 3 days after. Compliance assessments take two to three weeks depending on evidence availability. Retainers begin monitoring in their first week — onboarding in week one, monitoring from day eight.',
    keywords: ['long', 'timeline', 'weeks', 'days', 'duration', 'take'],
    home: true,
  },
  {
    q: 'What happens after payment?',
    a: 'You receive a receipt immediately, and an engagement coordinator emails you within one business day with a scoping questionnaire and two proposed kickoff slots. Work starts only after you sign the scope.',
    keywords: ['after payment', 'after i pay', 'receipt', 'kickoff', 'next step', 'happens'],
    home: true,
  },
  {
    q: 'Which currency am I charged in?',
    a: 'Charges settle in USD — always. KES, GBP and EUR figures anywhere on this site are display equivalents at the public rate, and every converted price carries its USD equivalent so nobody is surprised at the Paystack page. The amount shown at checkout is the amount charged.',
    keywords: ['currency', 'usd', 'kes', 'gbp', 'eur', 'charged', 'charge', 'pay', 'shillings'],
    home: true,
  },
  {
    q: 'How do I pay?',
    a: 'By card through Paystack’s hosted checkout — card data never passes through VUNVAULT servers. Pick your plan, leave your email for the receipt and kickoff contact, and the Paystack page handles the rest.',
    keywords: ['pay', 'payment', 'card', 'paystack', 'mpesa', 'checkout', 'bank'],
    home: true,
  },
  {
    q: 'What does the Starter assessment deliver?',
    a: 'External attack-surface enumeration of one estate, a vulnerability scan with manual validation of findings, an executive summary with a prioritised remediation checklist, and a 30-day re-scan of fixed findings. External IP and domain enumeration, port and SSL checks included.',
    keywords: ['starter', 'small business', 'cheap', 'cheapest', 'basic', 'entry', 'plan'],
    home: true,
  },
  {
    q: 'What does the SACCO & Fintech Compliance assessment deliver?',
    a: 'CBK / SASRA control mapping against your live configuration, a Kenya DPA 2019 data-protection gap assessment, an evidence pack your auditor can ingest directly, and a remediation roadmap with owners and deadlines — plus a full external and API gateway assessment and mobile app / M-Pesa security check.',
    keywords: ['sacco', 'fintech', 'compliance', 'cbk', 'sasra', 'regulation', 'audit', 'mpesa'],
    home: true,
  },
  {
    q: 'What does the Enterprise Retainer include?',
    a: 'A named assessor team with a standing monthly scope, continuous attack-surface monitoring and regression testing, priority incident triage during business hours, and quarterly board-ready risk reporting — 24/7 attack surface monitoring, quarterly penetration testing and a dedicated security architect.',
    keywords: ['retainer', 'enterprise', 'continuous', 'monitoring', 'red team', 'monthly'],
    home: true,
  },
  {
    q: 'Where can I see the prices?',
    a: 'The plan grid with starting rates lives in the “Plans & Pricing” section on this home page and on the Services page; the exact amount is confirmed at checkout before you pay, and that is the amount charged.',
    keywords: ['price', 'prices', 'pricing', 'cost', 'how much', 'rates', 'fee', 'fees'],
    home: true,
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes — plans are bought per engagement, not as a lock-in. Start with a Starter assessment and move to a compliance assessment or a retainer whenever you are ready; each purchase is scoped and signed separately.',
    keywords: ['switch', 'upgrade', 'change plan', 'later', 'lock-in', 'contract'],
    home: true,
  },
  {
    q: 'Is the free scanner a real scan?',
    a: 'Honest answer: the public scanner runs passive checks only, and when the scanning backend is inactive it says so — its result ends with “scanner not active”. It never touches systems you do not own, and it asks for your consent before any check.',
    keywords: ['scanner', 'scan', 'free', 'vulnerability check', 'active', 'real'],
    home: false,
  },
  {
    q: 'How do I create an account?',
    a: 'There are no passwords: enter your email on the signup page, open the confirmation link we mail you, and type the six-digit code. Your account exists only after both steps, then you enrol your authenticator app with a QR code.',
    keywords: ['account', 'signup', 'sign up', 'register', 'password', 'create'],
    home: false,
  },
  {
    q: 'How do I sign in?',
    a: 'Passwordless: your email on the login page, then the confirmation link from your mailbox, then the six-digit code it leads to. If you enrolled an authenticator app, its code works as the second factor.',
    keywords: ['login', 'sign in', 'signin', 'access my account', 'code'],
    home: false,
  },
  {
    q: 'How do I contact the team?',
    a: 'The contact form routes to the right humans — engagements, reports, press or security disclosures — and the responsible disclosure page carries the channel for reporting vulnerabilities to us.',
    keywords: ['contact', 'email', 'reach', 'talk', 'human', 'phone', 'address'],
    home: false,
  },
  {
    q: 'What is VUNVAULT?',
    a: 'VUNVAULT is an African-rooted security company: penetration testing, vulnerability assessment and compliance work for web applications, APIs, SACCOs and fintechs — backed by our own research, tooling and detection stack.',
    keywords: ['vunvault', 'who are you', 'about', 'company', 'what do you do'],
    home: false,
  },
  {
    q: 'Do you publish research and advisories?',
    a: 'Yes — the newsroom carries the team’s posts and advisories, and the live telemetry panel on the About page mirrors the zero-day tracking feed the research team maintains.',
    keywords: ['research', 'advisory', 'advisories', 'blog', 'news', 'newsroom', 'cve', 'zero-day'],
    home: false,
  },
];

/** The entries the home page renders, in list order. */
export const HOME_QA: readonly QaEntry[] = ZURA_KB.filter((entry) => entry.home);
