# Operator runbook (Task 103)

Day-2 operations for the VUNVAULT platform. Every procedure assumes the
bastion-only access model: `oci bastion session create` for both cluster APIs
(`scripts/deploy/oci-bastion-tunnel.sh` wraps it), no SSH except break-glass
into the k3s control node.

## Rotate a normal secret (Vault → pods)

1. Put the new value: `oci vault secret update-base64-content --secret-id <ocid> --secret-content <base64> --stage CURRENT` (or create a NEW version — Vault keeps the old one readable as `PREVIOUS`).
2. Workers: ESO re-syncs within 15 min; to force it, `kubectl -n vunvault annotate externalsecret vv-<worker>-secrets force-sync=$(date +%s)` then `kubectl -n vunvault rollout restart deploy/vv-<worker>`.
3. API: restart the deployment (`kubectl -n vunvault rollout restart deploy/vv-api`) — the in-process cache is 5 minutes, the restart skips the window.
4. k3s controller secret: re-run the Task 98 Terraform (`-target=module.k8s_bootstrap`) then `helm upgrade` the scan-controller (or `kubectl -n vv-scans rollout restart deploy/vv-scan-controller`).
5. Verify: one smoke pass (`node scripts/deploy/smoke.mjs --api … --web …`) and the worker logs show a clean reconnect.

## Rotate the audit HMAC key (dual-key window — never a bare swap)

The chain VERIFIES with `AUDIT_HMAC_KEY_ID → AUDIT_HMAC_KEY`; the API APPENDS
with its own current key. A bare swap breaks verification of every historical
entry sealed with the old key.

1. Mint the new key; store it in Vault under a NEW secret name suffix (e.g. `AUDIT_HMAC_KEY_V2`) and register its OCID in `OCI_SECRET_MAP` / the ESO map.
2. Deploy the API configured to APPEND with the new key id while still able to READ both (the key ring: `hmacKeyFor(keyId)` — the maintenance worker's `verify_chain` already resolves per-entry `key_id`).
3. Let one full `verify_chain` cycle (6 h) run with 0 mismatches.
4. Only after a re-seal migration of historical entries (a deliberate, ticketed project — `-- allow-destructive:` does not apply; re-sealing is additive) may the old key leave the ring.
5. `AUDIT_ALERT_EMAIL` receives the page if ANY step shows mismatches; treat it as an incident, not a rotation failure.

## Rotate `EDGE_ORIGIN_SECRET` (Worker FIRST, API second)

Order matters: the API accepts exactly one value. Worker-first means a window
where the API still expects the OLD value while the Worker sends the NEW one →
403s. So:

1. Deploy the API with `ORIGIN_VERIFY_ENFORCE=false` (documented escape hatch) — brief, monitored.
2. `wrangler secret put EDGE_ORIGIN_SECRET` (CD does this automatically from Vault; manually only in an incident).
3. Rotate the API's Vault value, restart the API with enforcement back ON.
4. Smoke: an unheadered `curl https://<origin-host>/api/v1/auth/csrf` direct-to-LB must 403.

## Restore an audit snapshot from R2

1. `aws s3 cp s3://vv-<env>-audit/audit-snapshots/<date>.json . --endpoint-url https://<account>.r2.cloudflarestorage.com` (read-only credentials; the bucket is WORM-locked — objects cannot have been altered or deleted inside 7 years, which is the point).
2. Compare `headSeq`/`headHash` with `GET /api/v1/admin/audit/chain` and the latest `audit_checkpoints` row.
3. A mismatch is a SEV-1: freeze report releases, page the incident commander, run `POST /api/v1/admin/audit/verify` (full, not incremental) and preserve the response.

## Re-enqueue a stuck broadcast

`outbox_reenqueue` (every 2 min) re-adds `queued` advisory broadcasts stuck
longer than `OUTBOX_STUCK_MINUTES` with the stable jobId `broadcast:<id>` —
BullMQ dedupes, so this is always safe. Manually: the same requeue through
the maintenance queue, or `POST /admin/advisories/:id/rebroadcast` for a new
delivery attempt (audited, permission-gated).

## Open a bastion session by hand

```sh
oci bastion session create-ported --bastion-id <OKE_BASTION_ID> \
  --target-ip-address <private-endpoint-ip> --target-port 6443 \
  --session-type PORT_FORWARDING
# then run the printed ssh command; it forwards a local port to the API.
```

## Scale a node pool / scan agents

OKE: `node_count` in the Task 98 stack (plan → apply). k3s agents:
`scan_agent_count` — new agents join with the SAME cloud-init token; after
scaling, verify `kubectl get nodes -l vv/pool=scan` and the taint.

## Incident contacts

_(placeholder — fill before go-live; the Task 110 checklist refuses to tick
this row empty)_

- Incident commander rotation: TODO
- OCI tenancy admin: TODO
- Cloudflare account owner: TODO
- On-call escalation path: TODO
