import { XMLParser } from 'fast-xml-parser';
import type { Severity } from '../emit.js';

/**
 * nmap adapter (Task 87) — XML in, summary lines and findings out.
 *
 * The scan is a TCP connect scan (`-sT`) with no OS detection, because the pod
 * has no `CAP_NET_RAW`. nmap writes XML to stdout (`-oX -`), which is parsed
 * here rather than by reading a file: the pod's filesystem is read-only apart
 * from a tmpfs, and keeping the parse in memory avoids a second write path.
 *
 * Findings are OUR judgement, not nmap's — nmap reports open ports, and an open
 * Telnet or an internet-facing database port is what makes that a security
 * problem. Each carries remediation text, because a finding without a next step
 * is noise in a client report.
 */

export interface NmapPort {
  ip: string;
  port: number;
  protocol: string;
  state: string;
  service: string;
  product: string;
  version: string;
}

export interface NmapParseResult {
  ports: NmapPort[];
  /** `[*] 41.90.64.199:443/tcp open https nginx 1.24.0` */
  lines: string[];
  findings: NmapFinding[];
}

export interface NmapFinding {
  severity: Severity;
  title: string;
  description: string;
  cwe?: string;
  remediation: string;
}

/** Ports that should never be reachable from the internet, and why. */
const RISKY_PORTS: Record<
  number,
  { severity: Severity; title: string; remediation: string; cwe: string }
> = {
  21: {
    severity: 'high',
    title: 'FTP service exposed',
    remediation:
      'Disable FTP or replace it with SFTP/FTPS. FTP transmits credentials in cleartext.',
    cwe: 'CWE-319',
  },
  23: {
    severity: 'high',
    title: 'Telnet service exposed',
    remediation: 'Disable Telnet and use SSH. Telnet transmits credentials in cleartext.',
    cwe: 'CWE-319',
  },
  445: {
    severity: 'high',
    title: 'SMB service exposed to the internet',
    remediation:
      'Block TCP 445 at the perimeter. SMB must not be reachable from the public internet.',
    cwe: 'CWE-200',
  },
  3389: {
    severity: 'high',
    title: 'RDP service exposed to the internet',
    remediation:
      'Place RDP behind a VPN or a gateway with MFA, and block TCP 3389 from the internet.',
    cwe: 'CWE-200',
  },
  3306: {
    severity: 'high',
    title: 'MySQL database port exposed',
    remediation: 'Bind the database to a private interface and block TCP 3306 at the perimeter.',
    cwe: 'CWE-200',
  },
  5432: {
    severity: 'high',
    title: 'PostgreSQL database port exposed',
    remediation: 'Bind the database to a private interface and block TCP 5432 at the perimeter.',
    cwe: 'CWE-200',
  },
  1433: {
    severity: 'high',
    title: 'Microsoft SQL Server port exposed',
    remediation: 'Bind the database to a private interface and block TCP 1433 at the perimeter.',
    cwe: 'CWE-200',
  },
  27017: {
    severity: 'high',
    title: 'MongoDB port exposed',
    remediation:
      'Enable authentication, bind to a private interface and block TCP 27017 at the perimeter.',
    cwe: 'CWE-200',
  },
  6379: {
    severity: 'high',
    title: 'Redis port exposed',
    remediation:
      'Enable requirepass, bind to a private interface and block TCP 6379 at the perimeter.',
    cwe: 'CWE-200',
  },
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** Parse nmap's XML report. Malformed input yields nothing rather than throwing. */
export function parseNmapXml(xml: string): NmapParseResult {
  const empty: NmapParseResult = { ports: [], lines: [], findings: [] };
  if (xml.trim() === '') return empty;

  let parsed: unknown;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // Large reports: never treat a text node as a number or boolean.
      parseTagValue: false,
    }).parse(xml);
  } catch {
    return empty;
  }

  const root = parsed as { nmaprun?: { host?: unknown } };
  const hosts = asArray(root.nmaprun?.host);
  const ports: NmapPort[] = [];

  for (const host of hosts) {
    const hostRecord = host as {
      address?: unknown;
      ports?: { port?: unknown };
    };
    const addresses = asArray(hostRecord.address);
    const ip =
      addresses.find(
        (address) => text((address as { '@_addrtype'?: string })['@_addrtype']) === 'ipv4',
      ) ?? addresses[0];
    const hostIp = text((ip as { '@_addr'?: string } | undefined)?.['@_addr']);
    if (hostIp === '') continue;

    for (const portEntry of asArray(hostRecord.ports?.port)) {
      const record = portEntry as {
        '@_portid'?: string;
        '@_protocol'?: string;
        state?: { '@_state'?: string };
        service?: { '@_name'?: string; '@_product'?: string; '@_version'?: string };
      };
      const state = text(record.state?.['@_state']);
      if (state !== 'open') continue;
      const port = Number(record['@_portid']);
      if (!Number.isInteger(port)) continue;
      ports.push({
        ip: hostIp,
        port,
        protocol: text(record['@_protocol']) || 'tcp',
        state,
        service: text(record.service?.['@_name']),
        product: text(record.service?.['@_product']),
        version: text(record.service?.['@_version']),
      });
    }
  }

  const lines = ports.map((entry) => {
    const detail = [entry.service, entry.product, entry.version].filter((v) => v !== '').join(' ');
    return `[*] ${entry.ip}:${entry.port}/${entry.protocol} open ${detail}`.trimEnd();
  });

  const findings: NmapFinding[] = [];
  const seen = new Set<number>();
  for (const entry of ports) {
    const risky = RISKY_PORTS[entry.port];
    if (risky === undefined || seen.has(entry.port)) continue;
    seen.add(entry.port);
    findings.push({
      severity: risky.severity,
      title: risky.title,
      description: `Port ${entry.port}/${entry.protocol} is open on ${entry.ip}${
        entry.service === '' ? '' : ` running ${entry.service}`
      }, reachable from the scanned network position.`,
      cwe: risky.cwe,
      remediation: risky.remediation,
    });
  }

  return { ports, lines, findings };
}

/** True when the report shows the given TCP port open — the testssl gate. */
export function isPortOpen(result: NmapParseResult, port: number): boolean {
  return result.ports.some((entry) => entry.port === port && entry.state === 'open');
}

/** `http://ip:port` candidates for the network-scan nuclei step. */
export function webPortUrls(result: NmapParseResult): string[] {
  const urls = new Set<string>();
  for (const entry of result.ports) {
    if (entry.port === 80 || entry.service === 'http') urls.add(`http://${entry.ip}:${entry.port}`);
    if (entry.port === 443 || entry.service === 'https') {
      urls.add(`https://${entry.ip}:${entry.port}`);
    }
  }
  return [...urls];
}
