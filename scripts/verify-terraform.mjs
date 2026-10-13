#!/usr/bin/env node
/**
 * Terraform policy checker (Task 98).
 *
 * `terraform validate` proves the HCL parses; this script proves the HCL says
 * what the platform's security model requires — statically, without a
 * provider, a state file or a cloud. Rules:
 *
 *  1. no `*.tfvars` besides `example.tfvars` anywhere in the repo;
 *  2. every provider in use is version-pinned in a `required_providers` block;
 *  3. no hard-coded OCIDs (`ocid1.`) in any `.tf`/`.tfvars`;
 *  4. every `oci_vault_secret` resource carries `ignore_changes` on its
 *     content — secret VALUES are an operator concern, never a plan output;
 *  5. `0.0.0.0/0` as an NSG rule SOURCE appears only in the OKE load-balancer
 *     NSG, and only for TCP 80/443; inside `modules/network-scan` the string
 *     may appear ONLY in the NAT route table — never in a security rule,
 *     because the scan egress allow-list is the whole point of that module;
 *  6. the scan module contains no DRG or peering resource of any kind;
 *  7. NSG security rules in the scan module carry no IPv4 literal — every
 *     destination comes from a variable or the generated allow-list.
 *
 * Usage:
 *   node scripts/verify-terraform.mjs   → repo-wide, OK/FAIL + exit code
 *   import { checkTerraformFile, checkTree } → tests
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-terraform';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.turbo',
  '.git',
  '.terraform',
]);

const IPV4_CIDR = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}\b/;

/** Brace-matched blocks headed by `headerRegex`. */
function blocksOf(text, headerRegex) {
  const blocks = [];
  for (const match of text.matchAll(headerRegex)) {
    let depth = 0;
    let start = -1;
    for (let i = match.index; i < text.length; i += 1) {
      const char = text[i];
      if (char === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ header: match[0], body: text.slice(match.index, i + 1) });
          break;
        }
      }
    }
    void start;
  }
  return blocks;
}

function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line) && !/^\s*\/\//.test(line))
    .join('\n');
}

/** The enclosing resource type of an offset, or null. */
function enclosingResource(text, offset) {
  const before = text.slice(0, offset);
  const headers = [...before.matchAll(/resource\s+"([^"]+)"\s+"[^"]+"/g)];
  const last = headers.at(-1);
  // Only valid if the block still contains the offset — cheap approximation:
  // the last header before the offset owns it unless its block already closed.
  if (last === undefined) return null;
  const blockStart = last.index;
  let depth = 0;
  let closed = false;
  for (let i = blockStart; i < offset; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        closed = true;
        break;
      }
    }
  }
  return closed ? null : last[1];
}

/**
 * Check one file. `relativePath` is repo-relative with forward slashes.
 * @returns {string[]} violations, each `<rule>: <detail>`.
 */
export function checkTerraformFile(relativePath, text) {
  const violations = [];
  const code = stripComments(text);
  const inScanModule = relativePath.includes('modules/network-scan/');
  const inOkeNetwork = relativePath.endsWith('modules/network-oke/main.tf');

  // 1 — stray tfvars (checked in checkTree, but also here for direct calls).
  if (relativePath.endsWith('.tfvars') && !relativePath.endsWith('example.tfvars')) {
    violations.push(`tfvars: ${relativePath} must not exist — values come from CI env/TF_VAR_*`);
  }

  if (relativePath.endsWith('.tf')) {
    // 3 — no hard-coded OCIDs.
    if (/ocid1\./.test(code)) {
      violations.push('ocid: hard-coded OCID literal — ids are variables or outputs');
    }

    // 4 — vault secrets must ignore their content.
    for (const block of blocksOf(code, /resource\s+"oci_vault_secret"/g)) {
      if (!/ignore_changes\s*=\s*\[[^\]]*secret_content/.test(block.body)) {
        violations.push(
          `ignore-changes: ${block.header.trim()} lacks lifecycle.ignore_changes=[secret_content]`,
        );
      }
    }

    // 5 — wildcard sources only in the LB NSG, only for 80/443.
    for (const match of code.matchAll(/source\s*=\s*"0\.0\.0\.0\/0"/g)) {
      if (!inOkeNetwork) {
        violations.push(
          `wildcard: 0.0.0.0/0 source in ${relativePath} — only the OKE LB NSG may carry one`,
        );
        continue;
      }
      const resource = enclosingResource(code, match.index ?? 0);
      const block = blocksOf(
        code,
        /resource\s+"oci_core_network_security_group_security_rule"/g,
      ).find((candidate) => candidate.body.includes(match[0]));
      const body = block?.body ?? '';
      const okIngress =
        /direction\s*=\s*"INGRESS"/.test(body) &&
        /protocol\s*=\s*"6"/.test(body) &&
        /min\s*=\s*(80|443)\b/.test(body) &&
        /max\s*=\s*(80|443)\b/.test(body);
      if (!okIngress) {
        violations.push(
          `wildcard: 0.0.0.0/0 ingress in ${resource ?? 'unknown'} is not TCP 80/443`,
        );
      }
    }

    // 5b — inside the scan module, the wildcard may appear ONLY in the route
    // table (the NAT default route). Anywhere else defeats the allow-list.
    if (inScanModule) {
      for (const match of code.matchAll(/0\.0\.0\.0\/0/g)) {
        const resource = enclosingResource(code, match.index ?? 0);
        if (resource !== 'oci_core_route_table') {
          violations.push(
            `wildcard: 0.0.0.0/0 in the scan module outside a route table (${resource ?? 'top level'})`,
          );
        }
      }

      // 6 — no peering of any kind.
      if (
        /resource\s+"oci_core_(drg|drg_attachment|local_peering_gateway|remote_peering_connection)"/.test(
          code,
        )
      ) {
        violations.push('isolation: the scan module must not create DRG/peering resources');
      }
      if (/peering/.test(code)) {
        violations.push('isolation: the scan module must not mention peering at all');
      }

      // 7 — NSG rules carry no IPv4 literal: destinations come from locals,
      // variables or the generated allow-list.
      for (const block of blocksOf(
        code,
        /resource\s+"oci_core_network_security_group_security_rule"/g,
      )) {
        if (IPV4_CIDR.test(block.body)) {
          violations.push(
            `literals: NSG rule "${block.header.trim()}" contains an IPv4 literal — use local.scan_egress_cidrs or a variable`,
          );
        }
      }
    }
  }

  return violations;
}

/** Provider pinning is cross-file: gather `provider "x"` uses and pinned names. */
export function checkProviderPinning(filesByPath) {
  const pinned = new Set();
  const used = new Map(); // name → first file using it
  for (const [relativePath, text] of filesByPath) {
    const code = stripComments(text);
    for (const block of blocksOf(code, /required_providers\s*/g)) {
      for (const match of block.body.matchAll(/(\w+)\s*=\s*\{[^}]*version\s*=/g)) {
        pinned.add(match[1]);
      }
    }
    for (const match of code.matchAll(/provider\s+"([\w-]+)"\s*\{/g)) {
      if (!used.has(match[1])) used.set(match[1], relativePath);
    }
  }
  const violations = [];
  for (const [name, relativePath] of used) {
    if (!pinned.has(name)) {
      violations.push(
        `${relativePath}: pinned: provider "${name}" has no version constraint in any required_providers block`,
      );
    }
  }
  return violations;
}

/**
 * The Cloudflare stack's mandatory posture (Task 99): strict TLS, HSTS,
 * authenticated origin pulls, the 7-year audit lock, and no token-like
 * literal anywhere. Directory-level: the properties are spread across files.
 */
export function checkCloudflareStack(filesByPath) {
  const violations = [];
  const combined = [...filesByPath.entries()]
    .filter(([relativePath]) => relativePath.startsWith('infra/terraform/cloudflare/'))
    .map(([relativePath, text]) => `\n# ---- ${relativePath}\n${stripComments(text)}`)
    .join('\n');
  if (combined.trim() === '') return violations; // no CF stack → nothing to check

  if (!/ssl\s*=\s*"strict"/.test(combined)) {
    violations.push('cloudflare: zone ssl must be "strict"');
  }
  if (!/security_header\s*\{[^}]*enabled\s*=\s*true[^}]*preload\s*=\s*true/s.test(combined)) {
    violations.push('cloudflare: HSTS security_header must be enabled with preload');
  }
  if (
    !/resource\s+"cloudflare_authenticated_origin_pulls"[\s\S]*?enabled\s*=\s*true/.test(combined)
  ) {
    violations.push('cloudflare: authenticated origin pulls must be enabled');
  }
  const lock = /resource\s+"cloudflare_r2_bucket_lock"[\s\S]*?period\s*=\s*(\d+)/.exec(combined);
  if (lock === null) {
    violations.push('cloudflare: the audit bucket needs a cloudflare_r2_bucket_lock');
  } else if (Number(lock[1]) < 2555) {
    violations.push(
      `cloudflare: audit lock retention ${lock[1]} days is below the 7-year (2555) floor`,
    );
  }
  // Token-shaped literals near secret-ish words: CI env and Vault are the only
  // homes for these values.
  for (const line of combined.split('\n')) {
    if (/(token|secret|api[_-]?key)/i.test(line) && /[A-Za-z0-9_-]{37,}/.test(line)) {
      violations.push(`cloudflare: token-like literal in "${line.trim().slice(0, 60)}…"`);
    }
  }
  return violations;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

/**
 * Repo-wide check.
 * @returns {Promise<string[]>} violations (file-prefixed)
 */
export async function checkTree(root = REPO_ROOT) {
  const violations = [];
  const tfFiles = new Map();

  for await (const file of walk(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative.endsWith('.tfvars')) {
      // Rule 1 applies repo-wide: any real tfvars file is a violation.
      if (!relative.endsWith('example.tfvars')) {
        violations.push(
          `${relative}: tfvars: committed variable values — only example.tfvars may exist`,
        );
      }
      tfFiles.set(relative, await readFile(file, 'utf8'));
    } else if (relative.endsWith('.tf') && relative.startsWith('infra/')) {
      tfFiles.set(relative, await readFile(file, 'utf8'));
    }
  }

  for (const [relative, text] of tfFiles) {
    for (const violation of checkTerraformFile(relative, text)) {
      violations.push(`${relative}: ${violation}`);
    }
  }
  violations.push(...checkProviderPinning(tfFiles));
  violations.push(...checkCloudflareStack(tfFiles));
  return violations;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const violations = await checkTree();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${SCRIPT_NAME}: ${violation}`);
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}
