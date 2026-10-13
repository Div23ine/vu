import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import { checkDockerfile, checkRepo } from './verify-dockerfiles.mjs';

/**
 * The Dockerfile policy checker's own tests (Task 97).
 *
 * One passing sample, one failing sample per rule (the assertion is that the
 * violation MESSAGE names the rule, not just that something failed — a
 * checker that fails for the wrong reason is a checker nobody trusts), and the
 * real repository Dockerfiles must pass.
 */

const GOOD = `# syntax=docker/dockerfile:1.7
ARG NODE_BUILD_IMAGE
ARG DISTROLESS_IMAGE
FROM \${NODE_BUILD_IMAGE} AS base
WORKDIR /repo
FROM base AS build
ARG APP
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
FROM \${DISTROLESS_IMAGE} AS runtime
COPY --from=build --chown=65532:65532 /repo/dist /app/dist
USER 65532:65532
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["dist/main.js"]
`;

function expectViolation(text, rule, name = 'Dockerfile') {
  const violations = checkDockerfile(name, text);
  assert.ok(
    violations.some((violation) => violation.startsWith(`${rule}:`)),
    `expected a "${rule}" violation, got: ${JSON.stringify(violations)}`,
  );
}

describe('verify-dockerfiles — the rules', () => {
  test('a compliant Dockerfile passes', () => {
    assert.deepEqual(checkDockerfile('Dockerfile', GOOD), []);
  });

  test('rule syntax: the directive must lead', () => {
    expectViolation(GOOD.replace('# syntax=docker/dockerfile:1.7\n', ''), 'syntax');
  });

  test('rule stages: a single-stage build fails', () => {
    expectViolation(
      `# syntax=docker/dockerfile:1.7
FROM gcr.io/distroless/nodejs22-debian12:nonroot
USER 65532:65532
`,
      'stages',
    );
  });

  test('rule user: missing, named or root USER fails', () => {
    expectViolation(GOOD.replace('USER 65532:65532\n', ''), 'user');
    expectViolation(GOOD.replace('USER 65532:65532', 'USER node'), 'user');
    expectViolation(GOOD.replace('USER 65532:65532', 'USER 0:0'), 'user');
  });

  test('rule latest: a floating tag fails', () => {
    expectViolation(
      GOOD.replace(
        '${DISTROLESS_IMAGE} AS runtime',
        'gcr.io/distroless/nodejs22-debian12:latest AS runtime',
      ),
      'latest',
    );
  });

  test('rule from: an unpinned image fails', () => {
    expectViolation(
      `# syntax=docker/dockerfile:1.7
FROM node AS base
RUN true
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
USER 65532:65532
`,
      'from',
    );
  });

  test('rule add: a remote ADD fails', () => {
    expectViolation(
      GOOD.replace('COPY . .', 'ADD https://example.com/tool.tgz /tmp/tool.tgz'),
      'add',
    );
  });

  test('rule pipe-to-shell: curl | sh fails', () => {
    expectViolation(
      GOOD.replace(
        'RUN pnpm install --frozen-lockfile && pnpm build',
        'RUN curl -fsSL https://x.sh | sh',
      ),
      'pipe-to-shell',
    );
  });

  test('rule secret-name: a secret-shaped ARG or ENV fails', () => {
    expectViolation(GOOD.replace('ARG APP', 'ARG DB_PASSWORD'), 'secret-name');
    expectViolation(
      GOOD.replace('FROM base AS build', 'FROM base AS build\nENV API_TOKEN="x"'),
      'secret-name',
    );
    // A checksum suffix is a version pin, not a secret.
    assert.deepEqual(
      checkDockerfile('Dockerfile', GOOD.replace('ARG APP', 'ARG NUCLEI_SHA256')),
      [],
    );
  });

  test('rule privileges: --privileged, setcap, chmod 777, chmod +s, sudo fail', () => {
    expectViolation(
      GOOD.replace(
        'RUN pnpm install --frozen-lockfile && pnpm build',
        'RUN docker run --privileged x',
      ),
      'privileged',
    );
    expectViolation(
      GOOD.replace(
        'RUN pnpm install --frozen-lockfile && pnpm build',
        'RUN setcap cap_net_raw+ep /bin/nmap',
      ),
      'capabilities',
    );
    expectViolation(
      GOOD.replace('RUN pnpm install --frozen-lockfile && pnpm build', 'RUN chmod 777 /app'),
      'permissions',
    );
    expectViolation(
      GOOD.replace('RUN pnpm install --frozen-lockfile && pnpm build', 'RUN chmod +s /bin/busybox'),
      'permissions',
    );
    expectViolation(
      GOOD.replace('RUN pnpm install --frozen-lockfile && pnpm build', 'RUN sudo pnpm build'),
      'sudo',
    );
    // The runner's sticky-bit /tmp (1777) and 0755 binaries are fine.
    assert.deepEqual(
      checkDockerfile(
        'Dockerfile',
        GOOD.replace(
          'RUN pnpm install --frozen-lockfile && pnpm build',
          'RUN chmod 1777 /tmp && chmod 0755 /app/x',
        ),
      ),
      [],
    );
  });

  test('rule distroless: a non-distroless final stage fails (non-runner)', () => {
    expectViolation(
      `# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
RUN true
FROM debian:12-slim AS runtime
USER 65532:65532
`,
      'distroless',
    );
  });

  test('rule runner: exempt from distroless, but must verify checksums', () => {
    const runner = `# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
RUN echo "x  tool.zip" | sha256sum -c -
FROM debian:12-slim AS final
USER 65532:65532
`;
    assert.deepEqual(checkDockerfile('Dockerfile.runner', runner), []);
    expectViolation(runner.replace(' | sha256sum -c -', ''), 'runner', 'Dockerfile.runner');
  });
});

describe('verify-dockerfiles — the repository', () => {
  test('every real Dockerfile passes', async () => {
    const results = await checkRepo();
    const failures = [...results.entries()].filter(([, violations]) => violations.length > 0);
    assert.deepEqual(
      failures.map(([file, violations]) => `${file}: ${violations.join('; ')}`),
      [],
    );
    // The walk must have FOUND the two recipes, or the pass means nothing.
    assert.ok(results.size >= 2, `expected >= 2 Dockerfiles, found ${results.size}`);
    assert.ok([...results.keys()].some((file) => file === 'docker/node-service.Dockerfile'));
    assert.ok([...results.keys()].some((file) => file === 'apps/scan-worker/Dockerfile.runner'));
  });
});
