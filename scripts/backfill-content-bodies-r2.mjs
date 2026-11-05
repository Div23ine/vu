/**
 * Backfill content_items.body_md → R2 (content/bodies/{id}.md) and set body_r2_key.
 *
 * Usage (from repo root, with API env loaded):
 *   node --env-file=apps/api/.env scripts/backfill-content-bodies-r2.mjs
 *
 * Requires: DATABASE_URL, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID,
 *           R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL
 *
 * Safe to re-run: skips rows that already have body_r2_key.
 */
import postgres from 'postgres';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const PREFIX = 'content/bodies/';

const required = [
  'DATABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env ${key}`);
    process.exit(1);
  }
}

const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const rows = await sql`
  select id::text as id, body_md
  from content_items
  where body_md is not null
    and length(trim(body_md)) > 0
    and (body_r2_key is null or body_r2_key = '')
`;

console.log(`Backfilling ${rows.length} content bodies to R2…`);
let ok = 0;
let fail = 0;

for (const row of rows) {
  const key = `${PREFIX}${row.id}.md`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: Buffer.from(row.body_md, 'utf8'),
        ContentType: 'text/markdown; charset=utf-8',
      }),
    );
    await sql`
      update content_items
      set body_r2_key = ${key}, updated_at = now()
      where id = ${row.id}::uuid
    `;
    ok += 1;
    process.stdout.write('.');
  } catch (err) {
    fail += 1;
    console.error(`\nFailed ${row.id}:`, err?.message ?? err);
  }
}

console.log(`\nDone. ok=${ok} fail=${fail}`);
await sql.end();
process.exit(fail > 0 ? 1 : 0);
