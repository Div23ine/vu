import process from 'node:process';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

/** Give in-flight requests ten seconds to finish, then exit hard. */
const CLOSE_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp({ env });

  await app.listen({ host: '0.0.0.0', port: env.PORT });

  let closing = false;
  const close = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');

    const deadline = setTimeout(() => {
      app.log.error({ signal }, 'graceful close timed out');
      process.exit(1);
    }, CLOSE_TIMEOUT_MS);
    deadline.unref();

    try {
      await app.close();
      clearTimeout(deadline);
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'graceful close failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void close('SIGTERM'));
  process.on('SIGINT', () => void close('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('failed to start the API:', error);
  process.exit(1);
});
