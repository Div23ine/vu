import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Security headers for a JSON-only API.
 *
 * `default-src 'none'` and `frame-ancestors 'none'` mean the API never renders
 * anything and can never be framed. Swagger UI at `/docs` needs inline assets, so
 * the CSP is lifted for those paths only, and only outside production where the
 * UI is not served at all.
 */
const securityHeadersPlugin: FastifyPluginAsync = async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    frameguard: { action: 'deny' },
  });

  if (app.env.NODE_ENV !== 'production') {
    app.addHook('onSend', async (request, reply) => {
      if (!request.url.startsWith('/docs')) return;
      reply.removeHeader('content-security-policy');
    });
  }
};

export default fp(securityHeadersPlugin, { name: 'security-headers' });
