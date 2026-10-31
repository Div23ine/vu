import { HOME_QA, ZURA_KB } from '../(marketing)/_components/qa-data';
import {
  ORGANISATION_FACTS,
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_NAME,
  routesByGroup,
  siteUrl,
} from '../../lib/seo';

/**
 * `/llms.txt` — the AEO (answer-engine optimisation) layer.
 *
 * `llms.txt` is a proposed Markdown convention that gives an LLM a small,
 * high-signal, already-summarised view of a site: who the entity is, what it
 * sells, and the canonical URL of every page worth reading. Retrieval-augmented
 * answer engines (ChatGPT search, Perplexity, Claude) increasingly fetch it
 * directly, and it costs nothing to serve.
 *
 * Two rules were applied to the content:
 *
 * - **Nothing is invented.** Every claim below is copy the site already publishes
 *   — the Q&A knowledge base in `qa-data.ts` is the same text Zura, the on-site
 *   assistant, answers verbatim, and the company facts are what `/contact` and
 *   the footer show. Page summaries come from the one route table `robots.ts` and
 *   `sitemap.ts` also read.
 * - **Nothing private is listed.** The portal, admin and checkout routes are
 *   omitted entirely, matching `robots.ts`.
 *
 * The "Questions buyers ask" section is the highest-value part for an answer
 * engine: it is an explicit question→answer mapping in the company's own words,
 * so a model can cite it rather than paraphrase a marketing page. Unlike
 * `FAQPage` JSON-LD, `llms.txt` carries no requirement that the same text be
 * visually rendered on an HTML page — it is its own document.
 */

export const revalidate = 3600;

/** The published self-description, reused verbatim rather than re-worded. */
const ENTITY_ANSWER = ZURA_KB.find((entry) => entry.q === 'What is VUNVAULT?')?.a;

function render(): string {
  const lines: string[] = [];

  lines.push(`# ${SITE_NAME}`);
  lines.push('');
  lines.push(`> ${SITE_DESCRIPTION}`);
  lines.push('');

  if (ENTITY_ANSWER !== undefined) {
    lines.push(ENTITY_ANSWER);
    lines.push('');
  }

  lines.push(
    `Also written ${SITE_ALTERNATE_NAMES.map((name) => `"${name}"`).join(', ')}. ` +
      `Based in ${ORGANISATION_FACTS.addressLocality}, ${ORGANISATION_FACTS.addressCountryName}.`,
  );
  lines.push('');
  lines.push(
    `- Support: ${ORGANISATION_FACTS.email} (Mon–Fri 08:00–18:00 EAT)\n` +
      `- Press: ${ORGANISATION_FACTS.pressEmail}\n` +
      `- Incident escalation: ${ORGANISATION_FACTS.incidentResponse}\n` +
      `- Reporting a vulnerability in VUNVAULT: ${siteUrl('/responsible-disclosure')}`,
  );
  lines.push('');

  for (const { group, routes } of routesByGroup()) {
    if (routes.length === 0) continue;
    lines.push(`## ${group}`);
    lines.push('');
    for (const route of routes) {
      lines.push(`- [${route.title}](${siteUrl(route.path)}): ${route.summary}`);
    }
    lines.push('');
  }

  if (HOME_QA.length > 0) {
    lines.push('## Questions buyers ask');
    lines.push('');
    for (const entry of HOME_QA) {
      lines.push(`### ${entry.q}`);
      lines.push('');
      lines.push(entry.a);
      lines.push('');
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function GET(): Response {
  return new Response(render(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
