#!/usr/bin/env node
/**
 * Render the per-service Vault OCID maps for `helm --set-json` (Task 102).
 *
 * Input: `SECRET_OCIDS_JSON` — the Task 98 `secret_ocids` output (name → OCID),
 * a repository variable. OCIDs are identifiers, not secrets; this script never
 * touches a secret VALUE. Output: one JSON file per service in --write <dir>,
 * each mapping the ENV names that service needs to its OCID.
 *
 * The per-service name lists mirror each app's config/env.ts — a name missing
 * from the input is a hard error, because a pod that boots without a secret it
 * declares fails later and more confusingly than this script does.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const SERVICE_SECRET_NAMES = {
  api: [
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'UPSTASH_REDIS_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYSTACK_SECRET_KEY',
    'RESEND_API_KEY',
    'AFRICASTALKING_API_KEY',
    'AFRICASTALKING_USERNAME',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'AUDIT_HMAC_KEY',
    'AUDIT_AES_KEY',
    'NVD_API_KEY',
    'TURNSTILE_SECRET_KEY',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'SCAN_CONTROLLER_HMAC_KEY',
    'EDGE_ORIGIN_SECRET',
  ],
  'broadcast-worker': [
    'REDIS_URL_OR_UPSTASH',
    'DATABASE_URL',
    'RESEND_API_KEY',
    'AFRICASTALKING_USERNAME',
    'AFRICASTALKING_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
  ],
  'notify-worker': [
    'REDIS_URL_OR_UPSTASH',
    'DATABASE_URL',
    'RESEND_API_KEY',
    'AFRICASTALKING_USERNAME',
    'AFRICASTALKING_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ],
  'maintenance-worker': [
    'REDIS_URL_OR_UPSTASH',
    'DATABASE_URL',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'AUDIT_HMAC_KEY',
  ],
};

/** The workers' Redis env name is REDIS_URL; the Vault entry is UPSTASH_REDIS_URL. */
const ALIASES = { REDIS_URL_OR_UPSTASH: 'UPSTASH_REDIS_URL' };

export function renderMaps(secretOcidJson) {
  let ocids;
  try {
    ocids = JSON.parse(secretOcidJson);
  } catch {
    throw new Error('SECRET_OCIDS_JSON is not valid JSON');
  }
  const maps = {};
  for (const [service, names] of Object.entries(SERVICE_SECRET_NAMES)) {
    const map = {};
    for (const name of names) {
      const vaultName = ALIASES[name] ?? name;
      const ocid = ocids[vaultName];
      if (typeof ocid !== 'string' || ocid === '') {
        throw new Error(`service "${service}" needs "${vaultName}" — missing from the OCID map`);
      }
      // The env name the container sees; REDIS_URL_OR_UPSTASH is bookkeeping.
      map[name === 'REDIS_URL_OR_UPSTASH' ? 'REDIS_URL' : name] = ocid;
    }
    maps[service] = map;
  }
  return maps;
}

async function main() {
  const writeIndex = process.argv.indexOf('--write');
  const outDir = writeIndex === -1 ? null : process.argv[writeIndex + 1];
  const input = process.env.SECRET_OCIDS_JSON;
  if (input === undefined || input === '') {
    console.error('FAIL: render-secret-map: SECRET_OCIDS_JSON is not set');
    process.exit(1);
  }
  const maps = renderMaps(input);
  if (outDir === null || outDir === undefined) {
    console.log(JSON.stringify(maps, null, 2));
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const [service, map] of Object.entries(maps)) {
    await writeFile(path.join(outDir, `${service}.json`), JSON.stringify(map));
  }
  console.log(`OK: render-secret-map wrote ${Object.keys(maps).length} maps to ${outDir}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).endsWith(path.join('scripts/deploy', 'render-secret-map.mjs'));

if (invokedDirectly) {
  await main();
}
