import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import {
  checkCloudflareStack,
  checkProviderPinning,
  checkTerraformFile,
  checkTree,
} from './verify-terraform.mjs';

/**
 * The Terraform policy checker's own tests (Task 98): the repo passes, and
 * each rule demonstrably fails on a fixture that violates ONLY that rule — a
 * checker whose failures cannot be attributed is a checker nobody trusts.
 */

const PINNED_ROOT = `
terraform {
  required_version = ">= 1.8"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}
provider "oci" {
  region = var.region
}
`;

function expectViolation(relativePath, text, rule) {
  const violations = checkTerraformFile(relativePath, text);
  assert.ok(
    violations.some((violation) => violation.startsWith(`${rule}:`)),
    `expected a "${rule}" violation for ${relativePath}, got: ${JSON.stringify(violations)}`,
  );
}

describe('verify-terraform — fixtures', () => {
  test('a compliant file passes', () => {
    assert.deepEqual(checkTerraformFile('infra/terraform/oci/ok.tf', PINNED_ROOT), []);
  });

  test('rule tfvars: a real tfvars file is refused', () => {
    expectViolation('infra/terraform/oci/production.tfvars', 'region = "x"\n', 'tfvars');
    assert.deepEqual(checkTerraformFile('infra/terraform/oci/example.tfvars', '# nothing\n'), []);
  });

  test('rule ocid: a hard-coded OCID is refused', () => {
    expectViolation(
      'infra/terraform/oci/bad.tf',
      'variable "x" { default = "ocid1.tenancy.oc1..aaaaaaa" }\n',
      'ocid',
    );
  });

  test('rule ignore-changes: a vault secret without it is refused', () => {
    expectViolation(
      'infra/terraform/oci/vault.tf',
      `resource "oci_vault_secret" "x" {
  secret_content = "Q0hBTkdFX01F"
}
`,
      'ignore-changes',
    );
    assert.deepEqual(
      checkTerraformFile(
        'infra/terraform/oci/vault.tf',
        `resource "oci_vault_secret" "x" {
  secret_content = "Q0hBTkdFX01F"
  lifecycle {
    ignore_changes = [secret_content]
  }
}
`,
      ),
      [],
    );
  });

  test('rule wildcard: a 0.0.0.0/0 source outside the LB NSG is refused', () => {
    expectViolation(
      'infra/terraform/oci/modules/k3s/main.tf',
      `resource "oci_core_network_security_group_security_rule" "bad" {
  direction = "INGRESS"
  protocol  = "6"
  source    = "0.0.0.0/0"
  tcp_options { destination_port_range { min = 22 max = 22 } }
}
`,
      'wildcard',
    );
  });

  test('rule wildcard: an LB ingress that is not 80/443 is refused', () => {
    expectViolation(
      'infra/terraform/oci/modules/network-oke/main.tf',
      `resource "oci_core_network_security_group_security_rule" "bad" {
  direction = "INGRESS"
  protocol  = "6"
  source    = "0.0.0.0/0"
  tcp_options { destination_port_range { min = 22 max = 22 } }
}
`,
      'wildcard',
    );
    // The real LB rule shape passes.
    assert.deepEqual(
      checkTerraformFile(
        'infra/terraform/oci/modules/network-oke/main.tf',
        `resource "oci_core_network_security_group_security_rule" "ok" {
  direction = "INGRESS"
  protocol  = "6"
  source    = "0.0.0.0/0"
  tcp_options { destination_port_range { min = 443 max = 443 } }
}
`,
      ),
      [],
    );
  });

  test('rule isolation: a DRG or peering resource in the scan module is refused', () => {
    for (const resource of [
      'oci_core_drg',
      'oci_core_drg_attachment',
      'oci_core_local_peering_gateway',
      'oci_core_remote_peering_connection',
    ]) {
      expectViolation(
        'infra/terraform/oci/modules/network-scan/main.tf',
        `resource "${resource}" "bad" {
  compartment_id = var.compartment_ocid
}
`,
        'isolation',
      );
    }
  });

  test('rule literals: an IPv4 literal in a scan NSG rule is refused', () => {
    expectViolation(
      'infra/terraform/oci/modules/network-scan/main.tf',
      `resource "oci_core_network_security_group_security_rule" "bad" {
  direction   = "EGRESS"
  protocol    = "all"
  destination = "8.8.8.0/24"
}
`,
      'literals',
    );
  });

  test('rule wildcard: 0.0.0.0/0 outside a scan route table is refused', () => {
    expectViolation(
      'infra/terraform/oci/modules/network-scan/main.tf',
      `locals {
  oops = "0.0.0.0/0"
}
`,
      'wildcard',
    );
    // The NAT default route is the one legal home.
    assert.deepEqual(
      checkTerraformFile(
        'infra/terraform/oci/modules/network-scan/main.tf',
        `resource "oci_core_route_table" "private" {
  route_rules {
    destination = "0.0.0.0/0"
  }
}
`,
      ),
      [],
    );
  });

  test('rule pinned: an unpinned provider is refused (cross-file)', () => {
    const unpinned = new Map([
      ['infra/a/versions.tf', 'terraform {\n  required_version = ">= 1.8"\n}\n'],
      ['infra/a/providers.tf', 'provider "oci" {\n  region = "x"\n}\n'],
    ]);
    const violations = checkProviderPinning(unpinned);
    assert.ok(
      violations.some((violation) => violation.includes('pinned:') && violation.includes('"oci"')),
      JSON.stringify(violations),
    );

    const pinned = new Map([
      ['infra/a/versions.tf', PINNED_ROOT],
      ['infra/a/providers.tf', 'provider "oci" {\n  region = "x"\n}\n'],
    ]);
    assert.deepEqual(checkProviderPinning(pinned), []);
  });
});

describe('verify-terraform — the Cloudflare stack rules', () => {
  const GOOD_CF = new Map([
    [
      'infra/terraform/cloudflare/zone-settings.tf',
      `resource "cloudflare_zone_settings_override" "this" {
  settings {
    ssl = "strict"
    security_header {
      enabled = true
      preload = true
    }
  }
}
resource "cloudflare_authenticated_origin_pulls" "this" {
  enabled = true
}
`,
    ],
    [
      'infra/terraform/cloudflare/r2.tf',
      `resource "cloudflare_r2_bucket_lock" "audit" {
  period = 2555
}
`,
    ],
  ]);

  test('a compliant stack passes', () => {
    assert.deepEqual(checkCloudflareStack(GOOD_CF), []);
  });

  test('relaxed TLS is refused', () => {
    const bad = new Map([...GOOD_CF].map(([k, v]) => [k, v.replace('"strict"', '"full"')]));
    assert.ok(checkCloudflareStack(bad).some((violation) => violation.includes('strict')));
  });

  test('a missing or short audit lock is refused', () => {
    const noLock = new Map([
      [
        'infra/terraform/cloudflare/zone-settings.tf',
        GOOD_CF.get('infra/terraform/cloudflare/zone-settings.tf'),
      ],
    ]);
    assert.ok(checkCloudflareStack(noLock).some((violation) => violation.includes('bucket_lock')));
    const shortLock = new Map([...GOOD_CF]);
    shortLock.set(
      'infra/terraform/cloudflare/r2.tf',
      shortLock.get('infra/terraform/cloudflare/r2.tf').replace('2555', '30'),
    );
    assert.ok(
      checkCloudflareStack(shortLock).some((violation) => violation.includes('below the 7-year')),
    );
  });

  test('a token-like literal near a secret word is refused', () => {
    const leaked = new Map([...GOOD_CF]);
    leaked.set(
      'infra/terraform/cloudflare/extra.tf',
      'locals {\n  cf_token = "v4.7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-bbbbbbbbbbbb"\n}\n',
    );
    assert.ok(checkCloudflareStack(leaked).some((violation) => violation.includes('token-like')));
  });
});

describe('verify-terraform — the repository', () => {
  test('the committed stack passes every rule', async () => {
    const violations = await checkTree();
    assert.deepEqual(violations, []);
  });
});
