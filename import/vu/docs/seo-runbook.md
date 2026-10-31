# SEO & AEO runbook

Goal, in one line: **when someone searches `vunvault`, the answer is us** — in a
search engine and in an LLM-backed answer engine — and every page that should be
found is findable, while every page that should not be indexed is provably
excluded.

Two halves: the **on-page technical baseline** (implemented in this repository,
described below) and the **off-page work** (search-console registration, entity
signals, links) which no code change can do and which is the checklist in
§Off-page.

---

## What is implemented

| Surface | File | What it does |
| --- | --- | --- |
| Single source of truth | `apps/web/src/lib/seo.ts` | Brand constants, organisation facts, the indexable route table, and every JSON-LD builder. |
| JSON-LD renderer | `apps/web/src/lib/json-ld.tsx` | Serialises a graph node into a `<script type="application/ld+json">` data block, escaping `<` so content cannot break out of the element. |
| `/robots.txt` | `apps/web/src/app/robots.ts` | Crawl policy + sitemap advertisement + an explicit AI-crawler group. |
| `/sitemap.xml` | `apps/web/src/app/sitemap.ts` | Every indexable route, plus blog articles fetched best-effort from the content API. |
| `/llms.txt` | `apps/web/src/app/llms.txt/route.ts` | Markdown brief for answer engines: entity, facts, one line per page, and the published Q&A. |
| Entity graph | `apps/web/src/app/layout.tsx` | `Organization` + `WebSite` JSON-LD on every page; site-wide title template, description, keywords, Open Graph and Twitter defaults including the share card. |
| FAQ graph | `apps/web/src/app/(marketing)/page.tsx` | `FAQPage` mirroring the visible `QaSection` band. |
| Service graph | `services/**/page.tsx` | `Service` on the catalogue and each of the three service pages; `BreadcrumbList` on the nested ones. |
| Article graph | `blog/[slug]/page.tsx` | `Article` + `BreadcrumbList`, `article` Open Graph type, per-article canonical. |
| Canonicals | every indexable page | `alternates.canonical` per route. |
| Index policy | `(auth)`, `(authed)`, `(marketing)/checkout` layouts | Group-level `noindex` covering client-component pages that cannot export metadata. |
| Tests | `src/lib/seo.test.ts`, `src/app/seo-surfaces.test.ts` | 37 tests pinning the route table, the URL helpers, the graph nodes and all three generated surfaces. |

**The invariant to protect:** `robots.ts`, `sitemap.ts`, `llms.txt` and the
`Service` JSON-LD all read `INDEXABLE_ROUTES` in `lib/seo.ts`. Nothing hard-codes
a URL list. If a page appears in one surface and not the others, that is a bug,
and `seo-surfaces.test.ts` is written to fail on it.

### Adding a public page

1. Create the route.
2. Add one entry to `INDEXABLE_ROUTES` in `lib/seo.ts` — `path`, `title`
   (matching the page's `metadata.title`), `summary`, `changeFrequency`,
   `priority`, `group`.
3. Add `alternates: { canonical: '<path>' }` to that page's `metadata`. If the
   page is a client component, put the metadata in a sibling `layout.tsx`
   (this is why `blog/layout.tsx` exists) — and remember that a layout's
   canonical is inherited, so any child route must override it.
4. Run `pnpm --filter web test seo` — the route-table tests check uniqueness,
   group coverage, path shape and that no private prefix leaked in.

That is the whole procedure. The page then appears in the sitemap, in
`llms.txt` and in the robots policy without further edits.

### Adding a private or throwaway page

Add it to `NOINDEX_PATHS` (crawlable, `noindex`) or `NOINDEX_PREFIXES`
(disallowed + `noindex`) in `lib/seo.ts`. See §Index policy for which.

---

## Index policy — and why the two buckets differ

The single most common SEO mistake is disallowing a page you also want
de-indexed. **A disallowed page cannot be fetched, so its `noindex` tag is never
seen**, and Google may still list the bare URL ("No information is available for
this page") from inbound links.

| Bucket | Treatment | Routes |
| --- | --- | --- |
| Public content | crawlable, indexable, in sitemap + `llms.txt` | `/`, `/about`, `/blog`, `/blog/[slug]`, `/contact`, `/pricing`, `/products`, `/services` and its three children, `/status`, `/privacy`, `/terms`, `/cookie-policy`, `/responsible-disclosure` |
| Crawlable, not indexable | `noindex` meta tag, **not** disallowed, not in sitemap | `/login`, `/login/mfa`, `/login/mfa/setup`, `/signup`, `/signup/enroll`, `/accept-invite`, `/newsletter/confirm`, `/academy`, `/checkout`, `/checkout/cancelled` |
| Private | disallowed **and** `noindex` at group-layout level | `/portal*`, `/admin*`, `/onboarding` |
| Not pages | disallowed | `/checkout/callback`, `/checkout/success/*`, `/api` |

`/academy` is in the middle bucket on purpose: the page itself is a one-line
placeholder that already declared `robots: { index: false }`. When real academy
content lands, move it into `INDEXABLE_ROUTES` and drop the `noindex`.

**Non-production builds are never indexable.** `robots.ts` emits a blanket
`Disallow: /` unless `NEXT_PUBLIC_SITE_URL` is a real public `https` host
(`isPublicSiteUrl`). A laptop, a preview URL or a staging host therefore cannot
enter the index as duplicate content. This is tested.

---

## AI crawler policy (AEO)

`robots.ts` has an explicit group for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`,
`ClaudeBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`,
`Perplexity-User`, `Applebot-Extended`, `Amazonbot`, `cohere-ai` and `CCBot`,
carrying **the same disallow list as the wildcard group**. That repetition is
load-bearing: robots.txt groups do not inherit, so a bot that matches `GPTBot`
ignores `*` entirely. Without it, `/portal` would have been wide open to exactly
the crawlers we most want answering questions about us.

**If training use is ever declined** (a business decision, not a technical one),
add these lines to both groups' `disallow` — and note that blocking
`Google-Extended` does **not** affect Google Search rankings or crawling, which
is governed by the separate `Googlebot` token:

```
Google-Extended: disallow /
CCBot:           disallow /
```

Retrieval for answering (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`)
should stay allowed — that is the traffic `llms.txt` exists to serve.

### About `/llms.txt`

It follows the proposed `llmstxt.org` convention: H1, a blockquote summary, prose,
then `##` sections of `- [Title](absolute-url): one-line description`. Nothing in
it is invented — the entity paragraph is the answer Zura already gives to "What
is VUNVAULT?", the company facts are what `/contact` and the footer publish, and
the page lines come from the route table. The `## Questions buyers ask` section
re-publishes `HOME_QA` verbatim, because an explicit question→answer mapping is
the most citable thing on the site for a retrieval engine.

The format is a proposal, not a standard: adoption is partial and no ranking
effect is guaranteed. It costs one static file to serve, so the asymmetry
favours shipping it.

---

## Structured data — what is emitted and what is deliberately not

Emitted:

- `Organization` (every page, `#organization`) — name, alternate spellings
  (`VunVault`, `Vunvault`, `VUN VAULT`), canonical URL, slogan, description,
  support and press contact points with real hours, postal address
  (Nairobi, KE), and `knowsAbout` covering the actual service vocabulary.
- `WebSite` (every page, `#website`) — referencing the organisation node via
  `publisher`, so the two are one connected graph rather than two islands.
- `Service` on `/services` and its three children, built from the route table.
- `BreadcrumbList` on the nested service pages and on every article.
- `Article` on `/blog/[slug]` — headline, published date, author display name,
  canonical, featured image when the CMS has one.

Deliberately **omitted**, with the reason (pinned by a test so neither can be
added casually):

- **`sameAs`** — no social or directory profile URLs exist anywhere in this
  repository. Invented profile URLs actively damage entity disambiguation, which
  is the opposite of the goal. Add them in §Off-page step 5, once real.
- **`potentialAction` / `SearchAction`** — the only public query surface is the
  blog's client-side filter, not a site-wide search endpoint, and Google retired
  the sitelinks-searchbox rich result in 2024.

`FAQPage` is emitted on the home page and matches the visible `QaSection` band —
see §FAQ / AEO content layer.

Google's own guidance is that structured data must describe content a user can
see on the page. Markup that describes invisible content is a spam signal, so
nothing above is emitted unless the same facts are rendered.

---

## FAQ / AEO content layer

`apps/web/src/app/(marketing)/_components/qa-data.ts` flags some entries
`home: true` and exports them as `HOME_QA`. For most of Revision 3 that copy was
orphaned: `_components/home/qa-section.tsx` implemented the section but no page
imported it, so the text existed only inside Zura's answers. `FAQPage` markup was
therefore held back — markup describing invisible content is a structured-data
spam signal — and the choice was put to the user rather than taken silently.

**User decision: mount the section and emit the markup.** The home page now
renders `<QaSection />` immediately after `<PricingPlans />` (the band's own copy
references the `#pricing` grid above it) and emits
`<JsonLd data={faqJsonLd(HOME_QA)} />` for the same entries. The two are wired
together on purpose: if `QaSection` is ever removed, the markup must go with it.

Keep that expectation honest when measuring: since August 2023 Google shows FAQ
rich results **only** for well-known, authoritative government and health sites,
so no SERP snippet should be expected. The value is answer-engine grounding and
on-page clarity — an LLM reading the home page gets an explicit question→answer
mapping in the company's own words.

---

## Brand rasters — how they were produced, and how to replace them

`public/brand/logo-512.png` (square, transparent, for `Organization.logo`) and
`public/brand/og-default.png` (1200×630 share card, wired into the root layout's
`openGraph.images` and `twitter.images`) are **rendered from the repository's own
`public/brand/logo.svg` monogram**, cropped to its measured artwork box with
sharp — not AI-generated, so the mark in the graph and in share previews is the
real one. The card sets the wordmark and tagline in Liberation Sans, which was
the only font available to the offline renderer; that is the one typographic
compromise, and it is the first thing design may want to redo.

To regenerate or re-artwork them, keep these invariants — they are asserted by
`src/lib/seo.test.ts` through `BRAND_ASSETS` in `lib/seo.ts`:

- logo raster ≥112×112, PNG/WebP, square preferred, transparent background;
- share card exactly 1200×630 and under ~1 MB;
- update `BRAND_ASSETS` in `lib/seo.ts` (the single place both the graph and the
  root layout read) rather than editing paths in two places.

`next/og` (`ImageResponse`) was considered for the card and rejected: it needs a
font resolvable at runtime on Cloudflare Workers, which the repo's own "no
filesystem on workerd" convention argues against.

---

## Verification

Local, against a dev or preview build:

```bash
curl -s $ORIGIN/robots.txt        # policy + Sitemap: line
curl -s $ORIGIN/sitemap.xml       # 15 static URLs (+ articles if the API is up)
curl -s $ORIGIN/llms.txt          # entity brief, grouped links, Q&A
curl -s $ORIGIN/ | grep -o 'application/ld+json'   # graph present
```

Then:

- **Rich Results Test** (`search.google.com/test/rich-results`) on the deployed
  home page, one service page and one article — confirms the graph parses and
  shows which types are eligible.
- **Schema.org validator** (`validator.schema.org`) for the same URLs.
- **Search Console → URL Inspection** on `/` and one deep page: confirms the
  canonical Google picked matches the one we declared, and that the page is
  indexable.
- **Search Console → robots.txt / Sitemaps** reports: both must show "OK" with no
  parse errors, and the sitemap must report the expected URL count.
- `site:vunvault.com` in Google: should return only the public-content bucket.
  Any `/portal`, `/admin`, `/login` or `/checkout` URL appearing there is a
  regression — check that the group layouts still export `noindex`.

Automated, in CI:

```bash
pnpm --filter web test seo        # 37 tests: route table, URLs, graphs, surfaces
```

---

## Off-page work (no code change can do this)

The technical baseline makes the site *legible*. Discoverability for a brand
query is mostly earned off-page, in roughly this order of return:

1. **Google Search Console** — verify the property (DNS TXT is the durable
   method), submit `https://<host>/sitemap.xml`, request indexing for `/` and the
   three service pages. Without this you are blind: no crawl stats, no query
   data, no manual-action warnings.
2. **Bing Webmaster Tools** — verify, submit the same sitemap, and enable
   IndexNow if the CDN allows it. Bing's index is what ChatGPT search and
   Copilot largely draw on, so this is disproportionately valuable for AEO
   relative to the effort.
3. **Google Business Profile** — "VUNVAULT", category *Security service* /
   *Cybersecurity*, Nairobi address, `support@vunvault.com`, `https://vunvault.com`.
   This is the strongest single entity signal for a local-rooted company and it
   is what produces a knowledge panel. Keep the name, address and phone
   **byte-identical** to the site footer (NAP consistency).
4. **Wikidata item** for the organisation, with the official website, inception
   date, headquarters and industry. Wikidata is the entity backbone several
   answer engines use; a clean item with a referenced official URL is cheap and
   durable. Do not create a Wikipedia article without independent, significant
   press coverage — it will be deleted and the deletion is itself a signal.
5. **Real profiles**, then add their URLs to `sameAs` in
   `organisationJsonLd()`: GitHub org, LinkedIn company page, X, and the sector
   directories that actually rank (e.g. Clutch, GoodFirms for security
   services). Only add profiles that genuinely exist — this is why `sameAs` is
   omitted today.
6. **Backlinks with entity relevance** — the highest-leverage ones for a security
   firm are: published advisories and CVE attributions (the
   `/responsible-disclosure` page and the newsroom are the assets that earn
   these), conference/meetup talks in Nairobi and the regional ecosystem, guest
   posts on security publications, and listings in CERT/vendor advisory feeds
   when a finding is credited to VUNVAULT.
7. **Press and bylines** — `press@vunvault.com` is already published. Each
   quoted mention with a link is both a ranking signal and an LLM citation
   candidate.
8. **Brand-SERP hygiene** — search `vunvault` monthly. Anything unrelated
   squatting the query (an unrelated same-name project, an expired domain, a typosquatted
   variant) should be noted; the fix is usually more branded content and links,
   not a technical change. Also confirm `vunvault.com`, `www.vunvault.com` and
   any legacy host 301 to a single canonical origin — split hosts split every
   signal above.

---

## Measurement

- **Primary:** rank and click-through for the exact query `vunvault` (should be
  position 1 with the sitelinks you control), and impressions for
  `vunvault + {penetration testing, Nairobi, Kenya, SACCO}`.
- **Secondary:** Search Console impressions/clicks per query over time; number
  of indexed URLs vs. the 15 static + article count in the sitemap (a widening
  gap means pages are being dropped or duplicated).
- **AEO-specific:** periodically ask ChatGPT/Perplexity/Claude "what is
  VUNVAULT" and "who does penetration testing in Nairobi" in a fresh session and
  record whether the answer is correct, cited, and whether it matches the copy in
  `llms.txt`. That is the only real test of answer-engine presence, and it is
  worth logging because it changes without any change on our side.
- **Regression guard:** `pnpm --filter web test seo` in CI.

---

## Known limitations

- **Canonicals are declared, not verified against production.** They are built
  from `NEXT_PUBLIC_SITE_URL`, so if `www` and apex are both live without a 301,
  the declaration alone will not consolidate them. Fix the redirect at the edge
  first.
- **`lastModified` is only emitted for blog articles**, where a real
  `publishedAt` exists. Static routes omit it rather than stamp the build time;
  a `lastmod` that changes on every deploy is noise that trains crawlers to
  ignore the field.
- **The sitemap's article list depends on the content API being up at
  regeneration time.** If it is down, the sitemap ships the static routes and
  logs a warning — a partial sitemap beats a 500. `revalidate` is 3600 s and, on
  Cloudflare, per-isolate unless the R2 incremental cache is bound (the same
  caveat `/blog/[slug]` documents).
- **No `hreflang`.** The site publishes English only. Add `alternates.languages`
  if a second locale ever ships; a wrong `hreflang` cluster is worse than none.
- **Ten pre-existing web test failures** are unrelated to this work and were
  present on the clean tree before it (contributor-count drift in
  `home-end`/`about-b`/`page.test.tsx`, `env.test.ts` expectations, and one
  signup-enroll wizard assertion). They are verified as pre-existing by running
  the same five files against `HEAD`; they are listed in `playbook.md` Known
  Gaps so they are not silently absorbed into this change.
