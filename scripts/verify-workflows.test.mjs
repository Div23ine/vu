import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import { checkWorkflow, collectThirdPartyActions } from './verify-workflows.mjs';
import { checkRepo } from './verify-workflows.mjs';

/**
 * The workflow policy checker's tests (Task 101): the repo's own workflows
 * pass, and each rule demonstrably fires on a minimal violating fixture.
 */

const GOOD = `name: ci
on:
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - run: pnpm verify
`;

function expectViolation(text, rule) {
  const violations = checkWorkflow('.github/workflows/fixture.yml', text);
  assert.ok(
    violations.some((violation) => violation.includes(`${rule}:`)),
    `expected a "${rule}" violation, got: ${JSON.stringify(violations)}`,
  );
}

describe('verify-workflows — fixtures', () => {
  test('a compliant workflow passes', () => {
    assert.deepEqual(checkWorkflow('.github/workflows/ci.yml', GOOD), []);
  });

  test('rule permissions: a workflow without top-level permissions fails', () => {
    expectViolation(GOOD.replace('permissions:\n  contents: read\n', ''), 'permissions');
  });

  test('rule timeout: a job without timeout-minutes fails', () => {
    expectViolation(GOOD.replace('    timeout-minutes: 15\n', ''), 'timeout');
  });

  test('rule trigger: pull_request_target fails', () => {
    expectViolation(GOOD.replace('  pull_request:', '  pull_request_target:'), 'trigger');
  });

  test('rule injection: github.event inside run fails (block and one-line)', () => {
    expectViolation(
      GOOD.replace(
        '      - run: pnpm verify',
        '      - run: |\n          echo "${{ github.event.issue.title }}"',
      ),
      'injection',
    );
    expectViolation(
      GOOD.replace(
        '      - run: pnpm verify',
        '      - run: echo ${{ github.event.comment.body }}',
      ),
      'injection',
    );
    // Through env is the sanctioned path.
    assert.deepEqual(
      checkWorkflow(
        '.github/workflows/ci.yml',
        GOOD.replace(
          '      - run: pnpm verify',
          '      - env:\n          TITLE: ${{ github.event.issue.title }}\n        run: echo "$TITLE"',
        ),
      ),
      [],
    );
  });

  test('rule secret-leak: echoing a secret fails', () => {
    expectViolation(
      GOOD.replace('      - run: pnpm verify', '      - run: echo ${{ secrets.DEPLOY_KEY }}'),
      'secret-leak',
    );
  });

  test('rule pipe-to-shell: curl | sh fails', () => {
    expectViolation(
      GOOD.replace('      - run: pnpm verify', '      - run: curl -fsSL https://x.sh | sh'),
      'pipe-to-shell',
    );
  });

  test('rule pin: a branch-pinned action fails, a tag and a SHA pass', () => {
    expectViolation(GOOD.replace('actions/checkout@v4', 'some/action@main'), 'pin');
    assert.deepEqual(
      checkWorkflow(
        '.github/workflows/ci.yml',
        GOOD.replace('actions/checkout@v4', 'some/action@v3.1.0'),
      ),
      [],
    );
    assert.deepEqual(
      checkWorkflow(
        '.github/workflows/ci.yml',
        GOOD.replace('actions/checkout@v4', 'some/action@b9a8b4b0b8f8e4d3a2c19f8e7d6c5b4a39281706'),
      ),
      [],
    );
  });

  test('rule checkout: missing persist-credentials fails outside release jobs', () => {
    expectViolation(
      GOOD.replace('        with:\n          persist-credentials: false\n', ''),
      'checkout',
    );
    // A release job may keep the credential (it pushes).
    assert.deepEqual(
      checkWorkflow(
        '.github/workflows/cd.yml',
        GOOD.replace('  verify:\n', '  deploy:\n    environment: production\n').replace(
          '        with:\n          persist-credentials: false\n',
          '',
        ),
      ),
      [],
    );
  });

  test('rule environment: a deploy-shaped job without environment: fails', () => {
    expectViolation(GOOD.replace('  verify:\n', '  deploy-oke:\n'), 'environment');
    // Named and gated: passes.
    assert.deepEqual(
      checkWorkflow(
        '.github/workflows/deploy.yml',
        GOOD.replace('  verify:\n', '  deploy-oke:\n    environment: staging\n'),
      ),
      [],
    );
    // Image builds are environment-agnostic by design.
    assert.deepEqual(
      checkWorkflow('.github/workflows/release.yml', GOOD.replace('  verify:\n', '  images:\n')),
      [],
    );
  });

  test('collectThirdPartyActions ignores local composite actions', () => {
    const used = collectThirdPartyActions(
      new Map([
        [
          'x.yml',
          'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/setup\n',
        ],
      ]),
    );
    assert.deepEqual([...used], ['actions/checkout']);
  });
});

describe('verify-workflows — the repository', () => {
  test('every committed workflow passes every rule', async () => {
    const violations = await checkRepo();
    assert.deepEqual(violations, []);
  });
});
