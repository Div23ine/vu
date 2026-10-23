import Link from 'next/link';

/**
 * Shared shell for the three productised service pages. Everything here is
 * prose a buyer can verify: scope, deliverables, timeline, the frameworks we
 * genuinely map to, one redacted sample finding, and the booking CTA that
 * preselects the matching tier on /pricing.
 */

export interface ServicePageContent {
  eyebrow: string;
  title: string;
  intro: string;
  scope: readonly { area: string; detail: string }[];
  deliverables: readonly string[];
  timeline: string;
  frameworks: readonly string[];
  finding: { id: string; title: string; severity: string; body: string };
  planCode: string;
  cta: string;
}

export const SAMPLE_REPORT_HREF = '/downloads/vunvault-sample-pentest-report.pdf';

export function ServicePage({ content }: { content: ServicePageContent }) {
  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              {content.eyebrow}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            {content.title}
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">{content.intro}</p>
        </header>

        <section aria-labelledby="scope">
          <h2 id="scope" className="text-xl font-extrabold text-neutral-900">
            What is tested
          </h2>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="border border-neutral-200 bg-neutral-50 p-3">Area</th>
                <th className="border border-neutral-200 bg-neutral-50 p-3">What we do in it</th>
              </tr>
            </thead>
            <tbody>
              {content.scope.map((row) => (
                <tr key={row.area}>
                  <td className="border border-neutral-200 p-3 font-bold text-neutral-900">
                    {row.area}
                  </td>
                  <td className="border border-neutral-200 p-3 text-neutral-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="deliverables">
          <h2 id="deliverables" className="text-xl font-extrabold text-neutral-900">
            What you receive
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-neutral-600">
            {content.deliverables.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-neutral-600">
            <strong className="text-neutral-900">Timeline:</strong> {content.timeline}
          </p>
        </section>

        <section aria-labelledby="frameworks">
          <h2 id="frameworks" className="text-xl font-extrabold text-neutral-900">
            Frameworks we map findings to
          </h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-600">
            {content.frameworks.map((framework) => (
              <li key={framework}>{framework}</li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="sample-finding"
          className="rounded-2xl border border-neutral-200 bg-white p-6"
        >
          <h2 id="sample-finding" className="text-xl font-extrabold text-neutral-900">
            A redacted sample finding
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-rose-700">
            {content.finding.id} · {content.finding.severity} · illustrative, anonymised
          </p>
          <h3 className="mt-3 text-sm font-bold text-neutral-900">{content.finding.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{content.finding.body}</p>
          <p className="mt-4 text-sm text-neutral-600">
            <a
              className="font-bold text-cyan-700 underline underline-offset-2"
              href={SAMPLE_REPORT_HREF}
              download
            >
              Download the full redacted sample report (PDF, watermarked SAMPLE)
            </a>
          </p>
        </section>

        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-center">
          <h2 className="text-xl font-extrabold text-neutral-900">{content.cta}</h2>
          <Link
            href={`/checkout?plan=${content.planCode}`}
            className="mt-4 inline-block rounded-xl bg-cyan-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-cyan-800"
          >
            Book at checkout
          </Link>
        </section>
      </div>
    </section>
  );
}
