import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * The defaults are deliberate: no incremental-cache override, so Next's cache
 * stays in the Worker's memory and nothing outside the Worker is required to
 * serve a request. For a mostly-static marketing site plus a session-driven
 * portal that is the right trade — ISR entries simply do not survive an isolate
 * eviction, and every miss revalidates against the API.
 *
 * To make ISR/`'use cache'` durable across isolates, add an R2 bucket and pass
 * the override — the Terraform stack already manages four R2 buckets, so add a
 * fifth there and bind it as `NEXT_INC_CACHE_R2_BUCKET` in `wrangler.jsonc`:
 *
 *   import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
 *
 * `defineCloudflareConfig()` also wires the asset manifest and the
 * `WORKER_SELF_REFERENCE` service binding that `wrangler.jsonc` declares.
 */
export default defineCloudflareConfig();
