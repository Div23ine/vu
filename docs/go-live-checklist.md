# Go-live checklist (Task 110)

**Nothing on this page is pre-ticked, and nothing here is automatable.**
Every row is a human act with a name against it. The build is done; this is
the part where the platform meets the world.

## Accounts and credentials

- [ ] OCI tenancy + compartment created; `vv-deployer` user with API key stored as a GitHub environment secret
- [ ] Cloudflare account + zone delegated; API token (Pages/Workers/R2/Zone scopes) stored as a GitHub environment secret
- [ ] Supabase project provisioned; `DIRECT_DATABASE_URL` (migrations) + pooler URL into Vault/`DATABASE_URL`
- [ ] Upstash Redis created; URL into Vault
- [ ] Stripe + Paystack live-mode keys into Vault; webhook endpoints registered and their signing secrets into Vault
- [ ] Resend, Africa's Talking, Twilio, Turnstile production credentials into Vault
- [ ] R2 S3-compatible API tokens minted OUT OF BAND into Vault (never Terraform)

## Infrastructure first-boot

- [ ] State bucket created: private, versioned, CMK-encrypted (ADR 0006 §5)
- [ ] `terraform providers lock -platform=linux/amd64` run for BOTH stacks; `.terraform.lock.hcl` committed
- [ ] Repository variables set: `NODE_BUILD_IMAGE` + `DISTROLESS_IMAGE` digests, the five scan-tool versions + checksums, `OCIR_REGISTRY`, bastion ids, `SECRET_OCIDS_JSON`
- [ ] Terraform applied: OCI first (two-phase kubeconfig dance), then Cloudflare with `api_origin_ip`
- [ ] EVERY Vault secret rotated off its `CHANGE_ME` placeholder (operator runbook)
- [ ] Origin-pull certificate minted, private key into Vault, ingress annotation verified
- [ ] GitHub environments created; `production` has required reviewers
- [ ] Audit bucket's compliance lock verified: an attempted delete of a snapshot FAILS

## Money (the row that cannot be argued with)

- [ ] One live USD transaction end-to-end (checkout → webhook → licence → invoice PDF → ledger balanced)
- [ ] That transaction refunded, and the refund visible in the ledger and the client's billing history
- [ ] **Written confirmation from Paystack** that USD M-Pesa works on THIS merchant account (attached to the release record)

## Legal and people

- [ ] Legal pages live and reviewed by counsel (terms, privacy, acceptable use, disclosure policy)
- [ ] Consent copy matches the recorded policy version (`policyVersion` in the consent store)
- [ ] External penetration test completed by a third party; findings triaged; report release date agreed
- [ ] On-call rotation staffed and published; escalation path tested once, by hand
- [ ] `docs/operator-runbook.md` incident contacts filled in (the runbook refuses to be complete with TODOs)
- [ ] `security.txt` signed with the disclosure key; mailbox monitored

## Cutover

- [ ] DNS cutover rehearsed on staging; TTLs lowered in advance
- [ ] `smoke.mjs` green against production AFTER cutover
- [ ] One k6 `api-smoke` + `headers-audit` pass against production
- [ ] Backup + restore of the database rehearsed once against a copy
