import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';

export interface OpenApiOptions {
  env: Env;
}

/**
OpenAPI 3.1 generation from the Zod schemas themselves — the document cannot
drift from the validation that actually runs.
Two security schemes describe how the API is called: the HttpOnly session
cookie (`vv_at`) and the double-submit CSRF header. The JSON document is always
served; the interactive UI is not exposed in production.
*/
const openApi: FastifyPluginAsync<OpenApiOptions> = async (app, options) => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'VUNVAULT API', version: '1.0.0' },
      servers: [{ url: options.env.API_PUBLIC_URL }],
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'vv_at' },
          csrf: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  // Swagger UI is wrapped in try/catch because it can hang in certain
  // network-restricted environments (WSL, corporate proxies, etc.)
  if (options.env.NODE_ENV !== 'production') {
    try {
      await app.register(swaggerUi, {
        routePrefix: '/docs',
        // Prevent swagger-ui from trying to fetch external resources
        theme: {
          title: 'VUNVAULT API Docs',
        },
      });
      app.log.info('Swagger UI available at /docs');
    } catch (error) {
      app.log.warn({ err: error }, 'Failed to register Swagger UI, continuing without it');
    }
  }

  app.get(
    '/openapi.json',
    { schema: { hide: true }, config: { hidden: true, rateLimit: false } },
    async () => app.swagger(),
  );
};

export default fp(openApi, { name: 'openapi' });
