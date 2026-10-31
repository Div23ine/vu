import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/mocks/server';

/**
 * MSW node-server lifecycle for every web test file.
 *
 * `onUnhandledRequest: "error"` is deliberate: a test whose request reaches
 * the real network is a hole in the mock layer, and failing the run beats
 * discovering it as a flake (or worse, as a request to a production origin).
 * Per-test variations belong in `server.use(...)` inside the test, which
 * `resetHandlers` unwinds here.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
