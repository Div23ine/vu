/**
 * The hero's Live Attack Surface illustration (Task 47).
 *
 * ARTWORK, not UI chrome: per the catalogue's illustration exception, the
 * literal fill/stroke colours below stay exactly as in the prototype and are
 * confined to this file. Six monitored nodes (cyan = edge/identity tier,
 * emerald = data tier) over dashed patrol links, with the pulse/dash/scan
 * animations driven from `hero.css` — the component itself is static markup,
 * so it renders on the server.
 */
export function NetworkMap() {
  return (
    <svg
      aria-label="Live map of protected network nodes"
      className="hero-network"
      role="img"
      viewBox="0 0 900 420"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="vv-link" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.15" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient cx="50%" cy="50%" id="vv-node" r="50%">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </radialGradient>
      </defs>
      <g className="hero-network-links" fill="none" stroke="url(#vv-link)" strokeWidth="1.6">
        <path d="M150 90 L330 150" />
        <path d="M330 150 L520 80" />
        <path d="M520 80 L740 140" />
        <path d="M150 90 L300 300" />
        <path d="M330 150 L300 300" />
        <path d="M520 80 L620 320" />
        <path d="M300 300 L620 320" />
        <path d="M740 140 L620 320" />
        <path d="M740 140 L520 80" strokeDasharray="5 6" />
        <path d="M150 90 L520 80" strokeDasharray="5 6" />
      </g>
      <g className="hero-network-nodes">
        <g className="hero-node">
          <circle cx="150" cy="90" fill="rgba(34,211,238,0.10)" r="26" />
          <circle cx="150" cy="90" fill="url(#vv-node)" r="11" />
          <text textAnchor="middle" x="150" y="52">
            API Gateway
          </text>
        </g>
        <g className="hero-node">
          <circle cx="330" cy="150" fill="rgba(34,211,238,0.10)" r="24" />
          <circle cx="330" cy="150" fill="url(#vv-node)" r="10" />
          <text textAnchor="middle" x="330" y="118">
            Core K8s
          </text>
        </g>
        <g className="hero-node">
          <circle cx="520" cy="80" fill="rgba(34,211,238,0.10)" r="24" />
          <circle cx="520" cy="80" fill="url(#vv-node)" r="10" />
          <text textAnchor="middle" x="520" y="46">
            Identity
          </text>
        </g>
        <g className="hero-node">
          <circle cx="740" cy="140" fill="rgba(34,211,238,0.10)" r="22" />
          <circle cx="740" cy="140" fill="url(#vv-node)" r="9" />
          <text textAnchor="middle" x="740" y="108">
            Edge CDN
          </text>
        </g>
        <g className="hero-node">
          <circle cx="300" cy="300" fill="rgba(52,211,153,0.10)" r="22" />
          <circle cx="300" cy="300" fill="#34d399" r="9" />
          <text textAnchor="middle" x="300" y="336">
            DB Replica
          </text>
        </g>
        <g className="hero-node">
          <circle cx="620" cy="320" fill="rgba(52,211,153,0.10)" r="22" />
          <circle cx="620" cy="320" fill="#34d399" r="9" />
          <text textAnchor="middle" x="620" y="356">
            Backup Vault
          </text>
        </g>
      </g>
    </svg>
  );
}
