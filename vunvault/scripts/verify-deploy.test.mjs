import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import {
  bakeTargets,
  checkChart,
  checkDeployOrdering,
  checkHelmInvocations,
  checkLibContract,
  checkRepo,
  registryRepos,
} from './verify-deploy.mjs';

/**
 * The deployment conformance suite's tests (Task 104): each rule fails on a
 * minimal violating fixture, and the committed estate passes as a whole.
 */

const GOOD_CHART = {
  'Chart.yaml': `apiVersion: v2
name: vv-api
dependencies:
  - name: vv-lib
    version: 0.1.0
    repository: file://../vv-lib
`,
  'values.yaml': `image:
  repository: ""
  tag: ""
replicaCount: 2
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: "1"
    memory: 512Mi
`,
  'templates/deployment.yaml': `{{- include "vv-lib.deployment" (dict "probe" (dict "path" "/healthz")) }}`,
  'templates/ingress.yaml': 'kind: Ingress\n',
};

describe('verify-deploy — chart rules', () => {
  test('a compliant api chart passes', () => {
    assert.deepEqual(checkChart('api', GOOD_CHART), []);
  });

  test('a chart without the pinned vv-lib dependency fails', () => {
    const chart = {
      ...GOOD_CHART,
      'Chart.yaml': 'apiVersion: v2\nname: vv-api\n',
    };
    assert.ok(checkChart('api', chart).some((v) => v.includes('vv-lib')));
  });

  test('a floating tag default fails', () => {
    const chart = {
      ...GOOD_CHART,
      'values.yaml': GOOD_CHART['values.yaml'].replace('tag: ""', 'tag: "latest"'),
    };
    const violations = checkChart('api', chart);
    assert.ok(violations.some((v) => v.includes('latest')));
    assert.ok(violations.some((v) => v.includes('image.tag')));
  });

  test('a secret VALUE in values.yaml fails, but pointers stay legal', () => {
    const withSecret = {
      ...GOOD_CHART,
      'values.yaml': `${GOOD_CHART['values.yaml']}stripeSecretKey: "sk_live_abcdef"\n`,
    };
    assert.ok(checkChart('api', withSecret).some((v) => v.includes('Vault')));

    const withPointer = {
      ...GOOD_CHART,
      'values.yaml': `${GOOD_CHART['values.yaml']}secretRef: vv-scan-controller-secrets\nociSecretMap: {}\n`,
    };
    assert.deepEqual(checkChart('api', withPointer), []);
  });

  test('single-replica api and worker shapes fail; workers need the ExternalSecret', () => {
    const oneReplica = {
      ...GOOD_CHART,
      'values.yaml': GOOD_CHART['values.yaml'].replace('replicaCount: 2', 'replicaCount: 1'),
    };
    assert.ok(checkChart('api', oneReplica).some((v) => v.includes('replicaCount')));

    const worker = {
      'Chart.yaml': GOOD_CHART['Chart.yaml'],
      'values.yaml': GOOD_CHART['values.yaml'],
      'templates/deployment.yaml': '{{- include "vv-lib.deployment" (dict) }}',
    };
    assert.ok(checkChart('notify-worker', worker).some((v) => v.includes('ExternalSecret')));
  });

  test('the library contract is checked fragment by fragment', () => {
    const good = {
      'templates/_workload.tpl': [
        'runAsNonRoot: true',
        'runAsUser: 65532',
        'readOnlyRootFilesystem: true',
        'drop: ["ALL"]',
        'allowPrivilegeEscalation: false',
        'type: RuntimeDefault',
        'ocir-pull',
        'image.tag is required',
        '{{- if not .image.tag -}}{{- fail "…" -}}',
        '{{- toYaml .resources | nindent 12 }}',
      ].join('\n'),
    };
    assert.deepEqual(checkLibContract(good), []);

    const degraded = {
      'templates/_workload.tpl': good['templates/_workload.tpl'].replace(
        'readOnlyRootFilesystem: true',
        'readOnlyRootFilesystem: false',
      ),
    };
    assert.ok(checkLibContract(degraded).some((v) => v.includes('readOnlyRootFilesystem')));
  });
});

describe('verify-deploy — the artefact triangle', () => {
  test('bake target parsing', () => {
    const targets = bakeTargets(`
target "_common" {
  platforms = ["linux/amd64"]
}
target "api" {
  inherits = ["_common"]
}
target "scan-runner" {
  dockerfile = "apps/scan-worker/Dockerfile.runner"
}
`);
    assert.deepEqual(targets, ['api', 'scan-runner']);
  });

  test('registry repository parsing', () => {
    const repos = registryRepos(`
locals {
  repositories = [
    "vv/api",
    "vv/scan-runner",
  ]
}
`);
    assert.deepEqual(repos, ['vv/api', 'vv/scan-runner']);
  });
});

describe('verify-deploy — pipeline ordering', () => {
  const job = (name, body) => `  ${name}:\n${body}\n`;

  test('a smoke job that skips the deploys is refused', () => {
    const yml = [
      job('release', '    uses: ./x'),
      job('migrate', '    needs: release'),
      job('deploy-oke', '    needs: [release, migrate]'),
      job('deploy-k3s', '    needs: [release, migrate]'),
      job('deploy-edge', '    needs: release'),
      job('deploy-web', '    needs: deploy-edge'),
      job('smoke', '    needs: [deploy-oke]'),
      job('rollback', "    if: failure() && needs.smoke.result == 'failure'\n    needs: [smoke]"),
    ].join('\n');
    const violations = checkDeployOrdering(yml);
    assert.ok(
      violations.some((v) => v.includes('smoke') && v.includes('deploy-web')),
      JSON.stringify(violations),
    );
  });

  test('the full correct order passes', () => {
    const yml = [
      job('release', '    uses: ./x'),
      job('migrate', '    needs: release'),
      job('deploy-oke', '    needs: [release, migrate]'),
      job('deploy-k3s', '    needs: [release, migrate]'),
      job('deploy-edge', '    needs: release'),
      job('deploy-web', '    needs: deploy-edge'),
      job('smoke', '    needs: [deploy-oke, deploy-k3s, deploy-edge, deploy-web]'),
      job('rollback', "    if: failure() && needs.smoke.result == 'failure'\n    needs: [smoke]"),
    ].join('\n');
    assert.deepEqual(checkDeployOrdering(yml), []);
  });
});

describe('verify-deploy — helm invocation policy', () => {
  test('bare install and kubectl apply are refused; atomic upgrades pass', () => {
    const violations = checkHelmInvocations(
      new Map([
        ['a.sh', 'helm install foo ./chart\n'],
        ['b.yml', 'run: kubectl apply -f x.yaml\n'],
        ['c.sh', 'helm upgrade --install --atomic --wait vv-api ./api\n'],
      ]),
    );
    assert.equal(violations.length, 2);
    assert.ok(violations.some((v) => v.includes('a.sh')));
    assert.ok(violations.some((v) => v.includes('kubectl apply')));
  });

  test('an upgrade without --atomic is refused', () => {
    const violations = checkHelmInvocations(
      new Map([['d.sh', 'helm upgrade --install vv-api ./api\n']]),
    );
    assert.ok(violations.some((v) => v.includes('--atomic')));
  });
});

describe('verify-deploy — the repository', () => {
  test('the committed estate passes every rule', async () => {
    const violations = await checkRepo();
    assert.deepEqual(violations, []);
  });
});
