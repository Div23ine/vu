import fp from 'fastify-plugin';
import rawBody from 'fastify-raw-body';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Raw body capture.
 *
 * Stripe and Paystack sign the *exact* bytes they sent, so a re-serialised JSON
 * body will never verify. Capture is opt-in per route (`config: { rawBody: true }`)
 * and runs before parsing, as a Buffer with no encoding assumption.
 */
const rawBodyPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
  });
};

export default fp(rawBodyPlugin, { name: 'raw-body' });
