import { setupServer } from 'msw/node';
import { handlers } from './handlers/index';

/**
 * Node MSW server for Vitest. The lifecycle (listen / resetHandlers / close)
 * belongs to `apps/web/vitest.setup.ts`, never to a test file.
 */
export const server = setupServer(...handlers);
