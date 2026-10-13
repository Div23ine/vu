import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Credentialed CORS, locked to the one web origin.
 *
 * The origin is compared exactly — never a wildcard, never reflected — because a
 * credentialed response to an arbitrary origin is how a session gets read from
 * another site. A request from any other origin simply receives no CORS headers.
 */
const corsPlugin: FastifyPluginAsync = async (app) => {
  const allowedOrigin = app.env.WEB_ORIGIN;

  await app.register(cors, {
    // A function, not a string: `@fastify/cors` echoes a string origin back to
    // every caller, which would be reflection. Comparing here means a request
    // from any other origin receives no CORS headers at all.
    origin: (origin, callback) => {
      callback(null, origin === allowedOrigin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
};

export default fp(corsPlugin, { name: 'cors' });
