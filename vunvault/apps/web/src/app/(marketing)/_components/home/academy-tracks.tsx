import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '../../_styles/academy-pricing.css';

/**
 * VUNVAULT Academy tracks (Task 51) — the three learning-track cards.
 *
 * Copy and skill chips are verbatim from the prototype. The decorative
 * thumbnail art was inline SVG there; here each track gets a small JSX
 * illustration component (ARTWORK — per the catalogue's illustration
 * exception its literal colours live in this file only). Server component:
 * the only interactivity is the `Explore Track` links.
 */

/* ——— Thumbnail artwork (literal colours allowed here — see header) ——— */

function FoundationsArt() {
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#3B99FC" strokeOpacity=".25" strokeWidth="1">
        <path d="M0 56h400M0 112h400M0 168h400M100 0v225M200 0v225M300 0v225" />
      </g>
      <g fill="none" stroke="#6FB6FF" strokeWidth="2">
        <path d="M200 52 L252 72 V122 c0 34-52 50-52 50 s-52-16-52-50 V72 z" />
      </g>
      <path
        d="M200 52 L252 72 V122 c0 34-52 50-52 50 s-52-16-52-50 V72 z"
        fill="#3B99FC"
        fillOpacity=".14"
      />
      <g fill="#6FB6FF">
        <circle cx="120" cy="170" r="5" />
        <circle cx="280" cy="170" r="5" />
        <circle cx="200" cy="196" r="4" />
      </g>
      <g stroke="#3B99FC" strokeOpacity=".55" strokeWidth="1.4" fill="none">
        <path d="M120 170 L200 118 L280 170" />
      </g>
    </svg>
  );
}

function BlueTeamArt() {
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect
        x="88"
        y="42"
        width="224"
        height="132"
        rx="10"
        fill="#3B99FC"
        fillOpacity=".08"
        stroke="#3B99FC"
        strokeOpacity=".45"
        strokeWidth="1.6"
      />
      <path
        d="M108 128 L146 128 L164 92 L186 150 L206 108 L222 128 L292 128"
        fill="none"
        stroke="#6FB6FF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="186" cy="150" r="5" fill="#f43f5e" />
      <circle cx="164" cy="92" r="4" fill="#34d399" />
      <g stroke="#3B99FC" strokeOpacity=".3" strokeWidth="1">
        <path d="M88 74h224M88 152h224" />
      </g>
    </svg>
  );
}

function RedTeamArt() {
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#3B99FC" strokeOpacity=".3" strokeWidth="1.2">
        <circle cx="200" cy="112" r="34" />
        <circle cx="200" cy="112" r="62" />
        <path d="M200 34v20M200 170v20M122 112h20M258 112h20" />
      </g>
      <circle cx="200" cy="112" r="8" fill="#f43f5e" />
      <circle cx="200" cy="112" r="16" fill="#f43f5e" fillOpacity=".2" />
      <path
        d="M118 178 l14 14 26-30"
        fill="none"
        stroke="#6FB6FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke="#6FB6FF" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round">
        <path d="M252 176h56M252 188h36" />
      </g>
    </svg>
  );
}

interface Track {
  badge: string;
  title: string;
  text: string;
  skills: readonly string[];
  art: () => React.ReactElement;
}

const TRACKS: readonly Track[] = [
  {
    badge: 'Foundations',
    title: 'Networking & Defense Foundations',
    text: 'Build the protocol-level intuition every defender needs — from TCP/IP and DNS to firewalls, segmentation and secure architecture.',
    skills: ['TCP/IP', 'DNS & TLS', 'Firewalls', 'Hardening'],
    art: FoundationsArt,
  },
  {
    badge: 'Blue Team',
    title: 'SOC Analyst & Incident Response',
    text: 'Triage alerts, hunt threats and run structured incident response playbooks inside a live SIEM and EDR lab environment.',
    skills: ['SIEM', 'Threat Hunting', 'DFIR', 'MITRE ATT&CK'],
    art: BlueTeamArt,
  },
  {
    badge: 'Red Team',
    title: 'Ethical Hacking & Web Pentesting',
    text: 'Recon, exploit and report. Work through OWASP Top 10 labs, API abuse chains and real-world bug-bounty style scenarios.',
    skills: ['OWASP Top 10', 'Burp Suite', 'API Security', 'Reporting'],
    art: RedTeamArt,
  },
];

export function AcademyTracks() {
  return (
    <section id="academy" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3.5 py-1 rounded-full border border-cyan-200">
            VUNVAULT Academy
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Learning tracks built for the real threat landscape
          </h2>
          <p className="text-neutral-500 text-sm md:text-base max-w-xl mx-auto">
            Structured, hands-on curriculum for defenders, analysts and offensive engineers with
            free certificate.
          </p>
        </div>

        <div className="vv-academy-grid">
          {TRACKS.map((track) => {
            const Art = track.art;
            return (
              <article key={track.badge} className="vv-track">
                <div className="vv-track-thumb">
                  <Art />
                  <span className="vv-track-badge">{track.badge}</span>
                </div>
                <div className="vv-track-body">
                  <h3 className="vv-track-title">{track.title}</h3>
                  <p className="vv-track-text">{track.text}</p>
                  <div className="vv-track-skills">
                    {track.skills.map((skill) => (
                      <span key={skill} className="vv-skill">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <Link href="/academy" className="vv-track-cta">
                    <span>Explore Track</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
