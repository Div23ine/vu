import Fastify from 'fastify';
import { connect as tlsConnect } from 'node:tls';
import { promisify } from 'node:util';
import dns from 'node:dns';

/**
 * VUNVAULT recon — the unprivileged scanner backend.
 *
 * Passive checks only: DNS resolution, TLS certificate facts and HTTPS
 * header presence. No port scans, no probes beyond one HEAD request to the
 * submitted host, nothing that touches systems without consent (the web UI
 * collects that consent before calling us). Runs in Docker as a non-root
 * user with all capabilities dropped.
 */

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

interface Finding {
  check: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

async function dnsChecks(domain: string): Promise<Finding[]> {
  const out: Finding[] = [];
  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      const value = await fn();
      out.push({ check: label, status: 'ok', detail: JSON.stringify(value).slice(0, 160) });
    } catch (error) {
      out.push({
        check: label,
        status: 'warn',
        detail: `no record (${(error as { code?: string }).code ?? 'error'})`,
      });
    }
  };
  await run('dns.a', () => resolve4(domain));
  await run('dns.aaaa', () => resolve6(domain));
  await run('dns.cname', () => resolveCname(domain));
  await run('dns.mx', () => resolveMx(domain));
  return out;
}

async function tlsChecks(domain: string): Promise<Finding[]> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      { host: domain, port: 443, servername: domain, timeout: 8000 },
      () => {
        const cert = socket.getPeerCertificate();
        const now = Date.now();
        const validFrom = new Date(cert.valid_from).getTime();
        const validTo = new Date(cert.valid_to).getTime();
        const daysLeft = Math.floor((validTo - now) / 86_400_000);
        const findings: Finding[] = [
          {
            check: 'tls.issuer',
            status: 'ok',
            detail: `${cert.issuer?.O ?? 'unknown issuer'} via ${cert.issuer?.CN ?? '?'}`,
          },
          {
            check: 'tls.expiry',
            status: daysLeft < 14 ? 'warn' : 'ok',
            detail:
              daysLeft < 0 ? `certificate expired ${-daysLeft} days ago` : `${daysLeft} days left`,
          },
          {
            check: 'tls.valid_now',
            status: now >= validFrom && now <= validTo ? 'ok' : 'fail',
            detail: `${cert.valid_from} → ${cert.valid_to}`,
          },
        ];
        socket.end();
        resolve(findings);
      },
    );
    socket.on('error', (error) => {
      resolve([{ check: 'tls.handshake', status: 'fail', detail: error.message }]);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve([{ check: 'tls.handshake', status: 'fail', detail: 'timeout after 8s' }]);
    });
  });
}

async function headerChecks(domain: string): Promise<Finding[]> {
  const url = `https://${domain}/`;
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const wanted: Array<[string, string]> = [
      ['strict-transport-security', 'HSTS'],
      ['content-security-policy', 'CSP'],
      ['x-frame-options', 'X-Frame-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy'],
    ];
    const findings = wanted.map<Finding>(([header, label]) => ({
      check: `http.${label.toLowerCase()}`,
      status: response.headers.has(header) ? 'ok' : 'warn',
      detail: response.headers.has(header) ? `${label} present` : `${label} missing`,
    }));
    findings.push({
      check: 'http.status',
      status: response.ok ? 'ok' : 'warn',
      detail: `GET-equivalent status ${response.status}`,
    });
    const server = response.headers.get('server');
    if (server !== null) {
      findings.push({
        check: 'http.server_banner',
        status: 'warn',
        detail: `server header exposes: ${server}`,
      });
    }
    return findings;
  } catch (error) {
    return [{ check: 'http.reach', status: 'fail', detail: (error as Error).message }];
  }
}

const app = Fastify({ logger: true });

app.get('/healthz', async () => ({ status: 'ok' }));

app.post<{ Body: { domain: string } }>('/recon', async (request, reply) => {
  const domain = (request.body?.domain ?? '').trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    return reply.status(400).send({ error: 'invalid_domain' });
  }
  const findings = [
    ...(await dnsChecks(domain)),
    ...(await tlsChecks(domain)),
    ...(await headerChecks(domain)),
  ];
  return reply.status(200).send({ data: { domain, findings, ranAt: new Date().toISOString() } });
});

const port = Number(process.env.PORT ?? 8090);
app.listen({ port, host: '0.0.0.0' }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
