-- Task 40b: the six premium products the public catalogue sells.
--
-- Idempotent by slug: re-running this file (or running it after an operator has
-- edited a product) never duplicates a row and never overwrites a change. Prices
-- are USD cents; `delivery_object_key` stays NULL until an operator uploads the
-- licensed archive to R2, and `downloadable` is derived from that at read time.
--
-- Copy below is verbatim from the catalogue: names, categories, unit labels, the
-- three features and the one-line description for each product.

INSERT INTO products (slug, name, category, description, features, price_usd_cents, unit_label, active, delivery_object_key, sort_order)
VALUES
  (
    'reconvault-pro',
    'ReconVault Pro',
    'Recon',
    'Continuous attack-surface enumeration engine with subdomain discovery, port fingerprinting and CVE correlation in a single CLI.',
    ARRAY[
      'CT-log & DNS brute subdomain enumeration',
      'Live CVE cross-reference & risk scoring',
      'JSON / SARIF export for CI pipelines'
    ]::text[],
    4900, 'license', true, NULL, 1
  ),
  (
    'vulnscope-api',
    'VulnScope API',
    'Scanning',
    'Headless vulnerability scanner exposed as a REST API — drop authenticated scans straight into your CI/CD or SOC automation.',
    ARRAY[
      'OWASP Top 10 + API abuse detection',
      'Authenticated & unauthenticated scan modes',
      'Webhook alerts & scheduled runs'
    ]::text[],
    12900, 'year', true, NULL, 2
  ),
  (
    'phishguard-kit',
    'PhishGuard Kit',
    'Human Risk',
    'Authorised phishing-simulation framework with landing-page templates, campaign tracking and staff-awareness scoring.',
    ARRAY[
      '40+ compliance-safe email templates',
      'Per-department risk scoring dashboard',
      'Automated awareness training follow-up'
    ]::text[],
    7900, 'license', true, NULL, 3
  ),
  (
    'loghound-siem-pack',
    'LogHound SIEM Pack',
    'Detection',
    '412 production-tested detection rules mapped to MITRE ATT&CK, packaged for Splunk, Elastic and Wazuh.',
    ARRAY[
      '412 rules across 14 ATT&CK tactics',
      'False-positive tuning notes per rule',
      'Purple-team validation playbooks'
    ]::text[],
    19900, 'pack', true, NULL, 4
  ),
  (
    'payloadforge',
    'PayloadForge',
    'Exploit Dev',
    'Encoder, obfuscator and payload staging console for authorised red-team engagements and detection-engineering validation.',
    ARRAY[
      'Multi-stage encoding chains',
      'AV / EDR evasion scoring',
      'Signed engagement audit log'
    ]::text[],
    9900, 'license', true, NULL, 5
  ),
  (
    'compliancemapper',
    'ComplianceMapper',
    'GRC',
    'Map scan findings to Central Bank, ISO 27001 and Data Protection requirements, then export a board-ready evidence pack.',
    ARRAY[
      'CBK / ISO 27001 / GDPR control mapping',
      'Evidence pack & audit trail export',
      'Gap analysis with remediation owners'
    ]::text[],
    14900, 'year', true, NULL, 6
  )
ON CONFLICT (slug) DO NOTHING;
