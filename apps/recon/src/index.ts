import Fastify from 'fastify';
import { request as httpsRequest } from 'node:https';
import { checkServerIdentity, connect as tlsConnect } from 'node:tls';
import { promisify } from 'node:util';
import dns from 'node:dns';
import { resolvePublicIPv4 } from './security.js';

/**
 * VUNVAULT recon — passive checks only: DNS facts, TLS certificate facts and
 * HTTPS security-header presence. All network connections use one validated,
 * pinned public IPv4 address. Redirects are never followed.
 */

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/;
const REQUEST_WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 10;
const MAX_CONCURRENT_SCANS = 2;

interface Finding {
  check: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

const app = Fastify({ logger: true, bodyLimit: 1024 });
const requestWindows = new Map<string, { startedAt: number; count: number }>();
let activeScans = 0;

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (requestWindows.size >= 10_000) {
    for (const [key, window] of requestWindows) {
      if (now - window.startedAt >= REQUEST_WINDOW_MS) requestWindows.delete(key);
    }
  }
  if (current === undefined || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
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

async function tlsChecks(domain: string, address: string): Promise<Finding[]> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host: address,
        port: 443,
        servername: domain,
        timeout: 8000,
        checkServerIdentity: (_hostname, cert) => checkServerIdentity(domain, cert),
      },
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
      resolve([{ check: 'tls.handshake', status: 'fail', detail: error.message.slice(0, 160) }]);
    });
    socket.on('timeout', () => {
      socket.destroy(new Error('timeout after 8s'));
    });
  });
}

async function headerChecks(domain: string, address: string): Promise<Finding[]> {
  return new Promise((resolve) => {
    const request = httpsRequest(
      {
        hostname: address,
        port: 443,
        path: '/',
        method: 'HEAD',
        headers: { host: domain },
        servername: domain,
        agent: false,
        timeout: 8000,
        checkServerIdentity: (_hostname, cert) => checkServerIdentity(domain, cert),
      },
      (response) => {
        response.resume();
        const wanted: Array<[string, string]> = [
          ['strict-transport-security', 'HSTS'],
          ['content-security-policy', 'CSP'],
          ['x-frame-options', 'X-Frame-Options'],
          ['referrer-policy', 'Referrer-Policy'],
          ['permissions-policy', 'Permissions-Policy'],
        ];
        const findings = wanted.map<Finding>(([header, label]) => ({
          check: `http.${label.toLowerCase()}`,
          status: response.headers[header] !== undefined ? 'ok' : 'warn',
          detail: response.headers[header] !== undefined ? `${label} present` : `${label} missing`,
        }));
        findings.push({
          check: 'http.status',
          status: (response.statusCode ?? 500) < 400 ? 'ok' : 'warn',
          detail: `HEAD status ${response.statusCode ?? 'unknown'}`,
        });
        const server = response.headers.server;
        if (typeof server === 'string') {
          findings.push({
            check: 'http.server_banner',
            status: 'warn',
            detail: `server header exposes: ${server.slice(0, 100)}`,
          });
        }
        resolve(findings);
      },
    );
    request.setTimeout(8000, () => request.destroy(new Error('timeout after 8s')));
    request.on('error', (error) => {
      resolve([{ check: 'http.reach', status: 'fail', detail: error.message.slice(0, 160) }]);
    });
    request.end();
  });
}

app.get('/healthz', async () => ({ status: 'ok' }));

app.post<{ Body: { domain: string } }>('/recon', async (request, reply) => {
  const domain = (request.body?.domain ?? '').trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    return reply.status(400).send({ error: 'invalid_domain' });
  }
  if (!allowRequest(request.ip)) {
    return reply.status(429).send({ error: 'rate_limited' });
  }
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    return reply.status(503).send({ error: 'scanner_busy' });
  }

  activeScans += 1;
  try {
    let address: string;
    try {
      address = await resolvePublicIPv4(domain);
    } catch (error) {
      const reason = (error as Error).message;
      const status = reason === 'target_resolves_to_non_public_address' ? 403 : 422;
      return reply.status(status).send({ error: 'target_not_publicly_scannable' });
    }

    const findings = [
      ...(await dnsChecks(domain)),
      ...(await tlsChecks(domain, address)),
      ...(await headerChecks(domain, address)),
    ];
    return reply.status(200).send({
      data: { domain, findings, ranAt: new Date().toISOString() },
    });
  } finally {
    activeScans -= 1;
  }
});

const port = Number(process.env.PORT ?? 8090);
app.listen({ port, host: '0.0.0.0' }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
