#!/usr/bin/env node
/**
 * Deployment conformance suite (Task 104).
 *
 * The cross-artefact layer: Tasks 97–103 each gate their own artefacts, and
 * this gates the SPACE BETWEEN them — the hardening contract every chart must
 * carry (it lives in vv-lib, but a chart could still drop it), the
 * bake-target ↔ chart ↔ registry-repository triangle where a missing edge is a
 * service that silently never deploys, and the deploy pipeline's ordering,
 * which is a security property (migrate before deploy; smoke before anyone
 * celebrates; rollback watching smoke).
 *
 * Everything is text-level: no helm, no docker, no cluster. That is the point
 * — the suite runs in `pnpm verify` on a laptop in two seconds.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-deploy';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELM_DIR = path.join(REPO_ROOT, 'infra/helm');

/** Bake target → chart directory. scan-runner is exempt: the controller
 * creates scan PODS from the runner image; nothing Helm-deploys it. */
export const TARGET_TO_CHART = {
  api: 'api',
  'broadcast-worker': 'broadcast-worker',
  'notify-worker': 'notify-worker',
  'maintenance-worker': 'maintenance-worker',
  'scan-controller': 'scan-controller',
};

const LIB_CONTRACT = [
  'runAsNonRoot: true',
  'runAsUser: 65532',
  'readOnlyRootFilesystem: true',
  'drop: ["ALL"]',
  'allowPrivilegeEscalation: false',
  'type: RuntimeDefault',
  'ocir-pull',
  'image.tag is required',
  'requests AND limits are not optional', // documented intent; the values check enforces the shape
];

/** Read the bake file's target names. */
export function bakeTargets(text) {
  return [...text.matchAll(/^target\s+"([^"_][^"]*)"\s*\{/gm)].map((match) => match[1]);
}

/** Read the registry module's repository list. */
export function registryRepos(text) {
  const block = /repositories\s*=\s*\[([\s\S]*?)\]/.exec(text);
  if (block === null) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/**
 * Check one chart's file map ({ 'Chart.yaml': text, 'values.yaml': text,
 * 'templates/deployment.yaml': text, … }).
 */
export function checkChart(name, files) {
  const violations = [];
  const chartYaml = files['Chart.yaml'] ?? '';
  const values = files['values.yaml'] ?? '';
  const allTemplates = Object.entries(files)
    .filter(([file]) => file.startsWith('templates/'))
    .map(([, text]) => text)
    .join('\n');

  // 1 — the shared library at an exact version (no ranges, no registries).
  if (name !== 'vv-lib') {
    if (
      !/dependencies:\s*\n\s*- name: vv-lib\n\s*version: \d+\.\d+\.\d+\n\s*repository: file:\/\/\.\.\/vv-lib/.test(
        chartYaml,
      )
    ) {
      violations.push(`${name}: Chart.yaml must depend on vv-lib at an exact file:// version`);
    }
  }

  // 2 — values hygiene.
  if (name !== 'vv-lib') {
    if (!/tag:\s*(?:""|'')/.test(values)) {
      violations.push(`${name}: values.yaml must default image.tag to "" (the fail-guard pattern)`);
    }
    // `:latest` in a value or an image reference — the vv-lib fail-guard's
    // MESSAGE quotes the word to forbid it, so bare-word matches don't count.
    if (/\blatest\b/.test(values) || /:latest\b/.test(allTemplates)) {
      violations.push(`${name}: the floating tag "latest" is never deployable`);
    }
    if (/pullPolicy:\s*(?!IfNotPresent)/.test(values + allTemplates)) {
      violations.push(`${name}: imagePullPolicy must be IfNotPresent (digests pinned by CI)`);
    }
    // 5 — no secret-looking VALUES. The key must END like a secret (so
    // `secretRef`/`ociSecretMap` — pointers, not material — stay legal) and
    // carry a non-empty scalar on the same line.
    for (const match of values.matchAll(
      /^[ \t]*([A-Za-z0-9_]*(?:password|secret|token|api_?key|key)s?)[ \t]*:[ \t]*(\S.*)$/gim,
    )) {
      const [, key, value] = match;
      const cleaned = value.replace(/#.*$/, '').trim();
      if (
        cleaned !== '' &&
        cleaned !== '{}' &&
        cleaned !== '[]' &&
        cleaned !== '""' &&
        cleaned !== "''"
      ) {
        violations.push(
          `${name}: values.yaml carries a value for "${key}" — secrets live in Vault`,
        );
      }
    }
    // 3 (values side) — resources must carry requests AND limits.
    if (
      !/requests:\s*\n\s*cpu:[\s\S]*?memory:/.test(values) ||
      !/limits:\s*\n\s*cpu:[\s\S]*?memory:/.test(values)
    ) {
      violations.push(`${name}: values.yaml resources must set requests and limits (cpu+memory)`);
    }
  }

  // 4 — per-chart shape.
  if (name === 'api') {
    if (
      !/replicaCount:\s*(\d+)/.test(values) ||
      Number(/replicaCount:\s*(\d+)/.exec(values)[1]) < 2
    ) {
      violations.push('api: replicaCount must be >= 2');
    }
    if (!allTemplates.includes('/healthz')) {
      violations.push('api: the deployment must probe /healthz');
    }
    if (!allTemplates.includes('kind: Ingress')) {
      violations.push('api: the chart must render an Ingress');
    }
  }
  for (const worker of ['broadcast-worker', 'notify-worker', 'maintenance-worker']) {
    if (name === worker) {
      if (
        !/replicaCount:\s*(\d+)/.test(values) ||
        Number(/replicaCount:\s*(\d+)/.exec(values)[1]) < 2
      ) {
        violations.push(`${worker}: replicaCount must be >= 2`);
      }
      if (
        !allTemplates.includes('vv-lib.externalSecret') &&
        !allTemplates.includes('kind: ExternalSecret')
      ) {
        violations.push(
          `${worker}: the chart must render its ExternalSecret (via vv-lib.externalSecret)`,
        );
      }
    }
  }
  if (name === 'scan-controller') {
    if (allTemplates.includes('kind: ExternalSecret')) {
      violations.push(
        'scan-controller: no ExternalSecret — the k3s cluster has no Vault access by design',
      );
    }
    if (
      !files['templates/deployment.yaml']?.includes('vv-scan-controller-secrets') &&
      !values.includes('vv-scan-controller-secrets')
    ) {
      violations.push(
        'scan-controller: the deployment must envFrom the Terraform-built vv-scan-controller-secrets',
      );
    }
    // The RBAC comment says "no pods/exec" out loud — strip comment lines so
    // only a real grant can trip the rule.
    const codeOnly = allTemplates
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    if (/pods\/exec/.test(codeOnly)) {
      violations.push('scan-controller: RBAC must never contain pods/exec');
    }
  }

  return violations;
}

/** 3 — the library template carries the whole hardening contract. */
export function checkLibContract(libFiles) {
  const violations = [];
  const workload = libFiles['templates/_workload.tpl'] ?? '';
  for (const fragment of LIB_CONTRACT.slice(0, 8)) {
    if (!workload.includes(fragment)) {
      violations.push(`vv-lib: the workload template lost "${fragment}"`);
    }
  }
  if (
    !/resources:\s*\n\s*\{\{-?\s*toYaml \.resources/.test(workload) &&
    !workload.includes('toYaml .resources')
  ) {
    violations.push('vv-lib: the workload template must wire .resources (requests AND limits)');
  }
  if (!/if not \.image\.tag/.test(workload) || !/fail /.test(workload)) {
    violations.push('vv-lib: the imageRef guard must fail on an empty tag');
  }
  return violations;
}

/** 9 — the deploy pipeline's ordering. */
export function checkDeployOrdering(deployYml) {
  const violations = [];
  // Slice the file into job blocks by their two-space-indented keys.
  const starts = [...deployYml.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)];
  const blocks = new Map();
  starts.forEach((match, index) => {
    const end = starts[index + 1] !== undefined ? starts[index + 1].index : deployYml.length;
    blocks.set(match[1], deployYml.slice(match.index ?? 0, end));
  });
  const needs = (job) => {
    const block = blocks.get(job);
    if (block === undefined) return null;
    const line = /needs:[ \t]*(.+)/.exec(block);
    if (line === null) return [];
    return [...line[1].matchAll(/[a-z][a-z0-9-]*/g)].map((match) => match[0]);
  };

  const expect = (job, required) => {
    const actual = needs(job);
    if (actual === null) {
      violations.push(`deploy.yml: job "${job}" is missing`);
      return;
    }
    for (const dependency of required) {
      if (!actual.includes(dependency)) {
        violations.push(`deploy.yml: job "${job}" must need "${dependency}"`);
      }
    }
  };

  expect('migrate', ['release']);
  expect('deploy-oke', ['release', 'migrate']);
  expect('deploy-k3s', ['release', 'migrate']);
  expect('deploy-web', ['deploy-edge']);
  expect('smoke', ['deploy-oke', 'deploy-k3s', 'deploy-edge', 'deploy-web']);
  expect('rollback', ['smoke']);
  if (!/if:\s*failure\(\)[^\n]*smoke/.test(deployYml)) {
    violations.push('deploy.yml: the rollback job must be gated on the smoke failure');
  }
  return violations;
}

/** 10 — every helm invocation in scripts/workflows upgrades atomically. */
export function checkHelmInvocations(texts) {
  const violations = [];
  for (const [file, text] of texts) {
    for (const match of text.matchAll(/helm\s+(?!dependency|lint|template|rollback)([a-z-]+)/g)) {
      const verb = match[1];
      if (verb === 'upgrade') {
        const from = text.lastIndexOf('\n', match.index ?? 0) + 1;
        const to = text.indexOf('\n', match.index ?? 0);
        const line = text.slice(from, to === -1 ? text.length : to);
        if (!line.includes('--install') || !line.includes('--atomic')) {
          violations.push(
            `${file}: helm upgrade must be "--install … --atomic" (got: ${line.trim().slice(0, 72)})`,
          );
        }
      } else if (verb === 'install' || verb === 'uninstall') {
        violations.push(
          `${file}: bare "helm ${verb}" — cluster changes go through upgrade --install --atomic`,
        );
      }
    }
    if (/kubectl\s+apply/.test(text)) {
      violations.push(
        `${file}: raw kubectl apply — cluster changes go through helm upgrade --install --atomic`,
      );
    }
  }
  return violations;
}

async function readChart(root, name) {
  const dir = path.join(root, name);
  const files = {};
  async function walk(relative) {
    for (const entry of await readdir(path.join(dir, relative), { withFileTypes: true })) {
      const rel = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(rel);
      else files[rel] = await readFile(path.join(dir, rel), 'utf8');
    }
  }
  await walk('');
  return files;
}

export async function checkRepo(root = REPO_ROOT) {
  const violations = [];
  const helmRoot = path.join(root, 'infra/helm');

  // Charts.
  const chartNames = (await readdir(helmRoot)).filter((entry) => !entry.endsWith('.md'));
  let libFiles = {};
  for (const name of chartNames.sort()) {
    const files = await readChart(helmRoot, name);
    if (name === 'vv-lib') {
      libFiles = files;
      continue;
    }
    violations.push(...checkChart(name, files));
  }
  violations.push(...checkLibContract(libFiles));

  // Bake ↔ chart ↔ registry triangle.
  const bakeText = await readFile(path.join(root, 'docker-bake.hcl'), 'utf8');
  const targets = bakeTargets(bakeText);
  for (const [target, chart] of Object.entries(TARGET_TO_CHART)) {
    if (!targets.includes(target))
      violations.push(`bake: target "${target}" is missing from docker-bake.hcl`);
    if (!chartNames.includes(chart))
      violations.push(`helm: chart "${chart}" (bake target "${target}") is missing`);
  }
  for (const target of targets) {
    if (target === 'scan-runner') continue;
    if (!(target in TARGET_TO_CHART)) {
      violations.push(`bake: target "${target}" has no chart mapping — a service nobody deploys`);
    }
  }
  const registryText = await readFile(
    path.join(root, 'infra/terraform/oci/modules/registry/main.tf'),
    'utf8',
  );
  const repos = registryRepos(registryText);
  for (const target of targets) {
    const expected = target === 'scan-controller' ? 'vv/scan-controller' : `vv/${target}`;
    if (!repos.includes(expected)) {
      violations.push(`registry: no OCIR repository "${expected}" for bake target "${target}"`);
    }
  }

  // Deploy pipeline ordering.
  const deployYml = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  violations.push(...checkDeployOrdering(deployYml));

  // Helm invocations across scripts and workflows.
  const helmTexts = new Map([
    ['.github/workflows/deploy.yml', deployYml],
    [
      '.github/workflows/rollback.yml',
      await readFile(path.join(root, '.github/workflows/rollback.yml'), 'utf8'),
    ],
    [
      '.github/workflows/iac.yml',
      await readFile(path.join(root, '.github/workflows/iac.yml'), 'utf8'),
    ],
    [
      'scripts/deploy/helm-deploy.sh',
      await readFile(path.join(root, 'scripts/deploy/helm-deploy.sh'), 'utf8'),
    ],
    ['infra/helm/README.md', await readFile(path.join(helmRoot, 'README.md'), 'utf8')],
    ['docs/deploy.md', await readFile(path.join(root, 'docs/deploy.md'), 'utf8')],
  ]);
  violations.push(...checkHelmInvocations(helmTexts));

  return violations;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const violations = await checkRepo();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${SCRIPT_NAME}: ${violation}`);
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}
