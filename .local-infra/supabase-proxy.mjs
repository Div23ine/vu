/**
 * Local-only shim that makes a bare GoTrue server look like the Supabase
 * platform endpoint supabase-js expects: `${SUPABASE_URL}/auth/v1/*` is
 * forwarded to GoTrue at `/*`. Nothing else is served.
 *
 * Listens on 127.0.0.1:54321 → GoTrue on 127.0.0.1:9999.
 */
import http from 'node:http';

const LISTEN_PORT = Number(process.env.PROXY_PORT ?? 54321);
const UPSTREAM = process.env.UPSTREAM ?? 'http://127.0.0.1:9999';
const PREFIX = '/auth/v1';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === PREFIX || url.pathname.startsWith(`${PREFIX}/`)) {
    url.pathname = url.pathname.slice(PREFIX.length) || '/';
  } else {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'only /auth/v1/* is proxied locally' }));
    return;
  }
  const target = new URL(url.pathname + url.search, UPSTREAM);
  const proxyReq = http.request(
    target,
    { method: req.method, headers: { ...req.headers, host: target.host } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `upstream failure: ${err.message}` }));
  });
  req.pipe(proxyReq);
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`supabase auth proxy listening on 127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM}`);
});
