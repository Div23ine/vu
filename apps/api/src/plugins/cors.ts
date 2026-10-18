import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Credentialed CORS, locked to an explicit allowlist of web origins.
 *
 * The origin is compared exactly against a list — never a wildcard, never reflected —
 * because a credentialed response to an arbitrary origin is how a session gets read
 * from another site. A request from any other origin simply receives no CORS headers.
 */
const corsPlugin: FastifyPluginAsync = async (app) => {
  // Split the comma-separated string from .env into an array and trim any spaces
  const allowedOrigins = app.env.WEB_ORIGIN.split(',').map((o) => o.trim());

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the incoming origin is in our allowed list
      const isAllowed = allowedOrigins.includes(origin);
      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
};

export default fp(corsPlugin, { name: 'cors' });
